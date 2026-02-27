# PTIS_S_TERRAFORM_SPEC
## Planetary Atmosphere Engineering — From Display to Endgame
### Version 1.0 — Design Brief

---

> **Purpose.** Canonical design for the terraforming arc from
> immediate code changes through long-term endgame mechanics.
> Structured in four phases of decreasing implementation detail:
> IMMEDIATE (pseudo-code), NEAR (design + sizing), MID (architecture),
> LONG (principles + math). Each phase is self-contained context for
> future sessions.
>
> **NNG compliance:** All atmospheric changes route through
> SimSettings (NNG-9 tick isolation). No new stream types (NNG-2,
> NNG-3). All flows ≥ 0 (NNG-4). All new species registered with
> full thermo data before use (NNG-10). SI internally (NNG-8).
> Single file (NNG-12).
>
> **Supersedes:** ATMOSPHERIC_AUDIT.md (findings incorporated here).
> References: PTIS_COMPOSITE_MODELS.md, PTIS_BIOSPHERE_POWER_
> RECONCILIATION.md, PTIS_S5_LITE_SPEC.md, PTIS_S_SIM_SPEC.md.

---

# 0. Planet X — Ground Truth (from processThis.html line 6882)

```javascript
planet_x: { name: 'Planet X', T_K: 305.15, P_Pa: 89660,
  air: { N2: 0.70, O2: 0.21, CO2: 0.08, Ar: 0.01 } }
```

## 0.1 Atmospheric Inventory (Earth-sized planet)

```
Surface pressure:     89,660 Pa (0.897 bar)
Surface temperature:  305.15 K (32.0°C)
Surface gravity:      9.81 m/s² (Earth-like, per design decision)
Surface area:         5.1 × 10¹⁴ m²

Atmospheric mass:     P × A / g = 89,660 × 5.1e14 / 9.81
                      = 4.66 × 10¹⁸ kg

Mean MW:  0.70×28.014 + 0.21×31.998 + 0.08×44.01 + 0.01×39.948
        = 19.610 + 6.720 + 3.521 + 0.399 = 30.25 g/mol

Total moles:  4.66e18 / 0.03025 = 1.54 × 10²⁰ mol
```

## 0.2 Species Budget

| Species | Fraction | Moles | Mass (kg) | Earth comparison |
|---------|----------|-------|-----------|------------------|
| N₂ | 70.0% | 1.078 × 10²⁰ | 3.02 × 10¹⁸ | Earth 78.1% |
| O₂ | 21.0% | 3.234 × 10¹⁹ | 1.03 × 10¹⁸ | Earth 21.0% ← identical |
| CO₂ | 8.0% | 1.232 × 10¹⁹ | 5.42 × 10¹⁷ | Earth 0.04% ← 200× too high |
| Ar | 1.0% | 1.540 × 10¹⁸ | 6.15 × 10¹⁶ | Earth 0.93% |

## 0.3 The Critical Insight: O₂ Is Already at 21%

Planet X's atmosphere is almost breathable. The ONLY problem is
8% CO₂. Above 5% CO₂ causes narcosis. Above 10% causes
unconsciousness. At 8%, you're dead in minutes without a mask.

This fundamentally shapes terraforming:

| Naive approach | Problem |
|---|---|
| Photosynthesis: CO₂→CH₂O+O₂ | Adds O₂. Already at 21%. Fire hazard above 23.5%. |
| CO₂ electrolysis: CO₂→CO+O₂ | Same problem — produces O₂ we don't need. |
| Sequester food (CH₂O→C+H₂O) | Net: −CO₂, +O₂. Still adds O₂. |
| BECCS (burn food + capture CO₂) | Net: −CO₂, ±0 O₂. **Only O₂-neutral path.** |
| Direct mineral carbonation | CO₂ + rock → carbonate. No O₂ change. Slow. |

**The player must remove 8% CO₂ without significantly changing 21% O₂.**

This is THE terraforming puzzle. The player who naively builds
photosynthesis at scale creates a fire hazard planet. The player
who thinks it through discovers BECCS or mineral carbonation.

## 0.4 Removal Target

```
CO₂ to remove:  8.0% → 0.04% = 7.96% of atmosphere
                = 1.226 × 10¹⁹ mol CO₂
                = 5.40 × 10¹⁷ kg CO₂
                = 540 Gt CO₂
```

## 0.5 O₂ Safety Window

```
Current O₂:  21.0%
Safe range:  19.5% – 23.5%

Budget for O₂ increase:  2.5% = 3.85 × 10¹⁸ mol
Budget for O₂ decrease:  1.5% = 2.31 × 10¹⁸ mol

If ALL CO₂ converted to O₂: O₂ → 21% + 8% = 29% → catastrophic
Only 2.5% of the 8% CO₂ can add O₂ before fire hazard.
The remaining 5.5% MUST be removed O₂-neutrally.
```

## 0.6 Humidity (new, not in current code)

```
Psat(H₂O) at 305.15K ≈ 4,730 Pa  (Antoine from ComponentRegistry)
At 50% RH: x_H2O = 0.50 × 4730 / 89660 = 0.0264 (2.6%)

Wet composition (displaces dry proportionally):
  N₂:  68.2%    (was 70.0%)
  O₂:  20.4%    (was 21.0%)
  CO₂:  7.8%    (was 8.0%)
  H₂O:  2.6%    (new)
  Ar:   1.0%    (unchanged)

Dew point at 50% RH: ~293K (20°C)
```

## 0.7 Vent Composition (from PTIS_COMPOSITE_MODELS §6)

```
H₂O: 30%, CO₂: 35%, N₂: 25%, CH₄: 10%
T: 500K, P: 3–8 bar (mission dependent)
```

The vents are a net CO₂ SOURCE. Terraforming must overcome the
natural volcanic CO₂ input. This is geologically realistic —
Planet X's high CO₂ is maintained by active volcanism.

## 0.8 Registered Reactions Relevant to Terraforming

Already in codebase (v13.7.0):

| Reaction | Equation | ΔH | Use |
|---|---|---|---|
| R_CH4_COMB | CH₄ + 2O₂ → CO₂ + 2H₂O | −802 kJ/mol | Power generation |
| R_H2_COMB | 2H₂ + O₂ → 2H₂O | −484 kJ/mol | Fuel cell, power |
| R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | +572 kJ/mol | O₂/H₂ production |
| R_CO2_ELEC | 2CO₂ → 2CO + O₂ | +566 kJ/mol | MOXIE (produces O₂!) |
| R_SABATIER | CO₂ + 4H₂ ⇌ CH₄ + 2H₂O | −165 kJ/mol | CO₂ recycling |
| R_RWGS | CO₂ + H₂ ⇌ CO + H₂O | +41 kJ/mol | CO₂ conversion |
| R_HABER | N₂ + 3H₂ ⇌ 2NH₃ | −92 kJ/mol | Fertilizer |

Planned (S9/S10, not yet registered):

| Reaction | Equation | ΔH | Use |
|---|---|---|---|
| R_PHOTOSYNTHESIS | CO₂ + H₂O → CH₂O + O₂ | +519 kJ/mol | Greenhouse |
| R_METABOLISM | CH₂O + O₂ → CO₂ + H₂O | −519 kJ/mol | Human |

**Not yet planned, needed for terraforming:**

| Reaction | Equation | ΔH | Use |
|---|---|---|---|
| R_MINERAL_CARB | CO₂ + MgSiO₃ → MgCO₃ + SiO₂ | −81 kJ/mol | Permanent sequestration, O₂-neutral |

---

# PHASE 1: IMMEDIATE (S5a-0 scope, ~2 hours)

Display-only changes. No new physics. No architectural changes.
Pure reads from existing `SimSettings.getAtmosphere()`.

## 1.1 Fix Hardcoded 101325 Defaults (10 min)

Three creation-time defaults bake Earth pressure instead of
reading the active planet.

```javascript
// Line 15765 — gas_turbine. BEFORE:
unit.params = { Pout: 101325, eta: 0.88 };
// AFTER:
unit.params = { Pout: SimSettings.atmosphere.P_Pa, eta: 0.88 };

// Line 15769 — valve. BEFORE:
unit.params = { Pout: 101325 };
// AFTER:
unit.params = { Pout: SimSettings.atmosphere.P_Pa };

// Line 15784 — source_multi. BEFORE:
unit.params = { n: { N2: 0.78, O2: 0.21, Ar: 0.01 },
                T: 298.15, P: 101325, phaseConstraint: 'V' };
// AFTER:
const _atm = SimSettings.getAtmosphere();
unit.params = { n: { ..._atm.air },
                T: _atm.T_K, P: _atm.P_Pa, phaseConstraint: 'V' };
```

**Test impact:** None — tests set params explicitly.
**NNG:** NNG-3 (WYSIWYG: equipment defaults match the planet).

## 1.2 Add RH to Atmosphere Presets (15 min)

Add relative humidity to preset schema. Compute wet composition
as a derived property.

```javascript
// In atmospherePresets:
planet_x: { name: 'Planet X', T_K: 305.15, P_Pa: 89660, RH: 0.50,
  air: { N2: 0.70, O2: 0.21, CO2: 0.08, Ar: 0.01 } },
earth_isa: { name: 'Earth (ISA)', T_K: 288.15, P_Pa: 101325, RH: 0.60,
  air: { N2: 0.7809, O2: 0.2095, Ar: 0.0093, CO2: 0.0003 } },
mars:  { ... RH: 0.0 },   // too cold, negligible vapor
titan: { ... RH: 0.0 },   // no H₂O (methane humidity future)
venus: { ... RH: 0.0 },   // trace H₂O, H₂SO₄ dominant

// New helper on SimSettings:
getWetAir() {
  const atm = SimSettings.atmosphere;
  const RH = atm.RH ?? 0;
  if (RH <= 0 || !ComponentRegistry.exists('H2O')) return atm.air;

  // Antoine for H₂O (from ComponentRegistry or fallback)
  const cd = ComponentRegistry.get('H2O');
  const Psat = cd.antoine
    ? Math.pow(10, cd.antoine.A - cd.antoine.B / (cd.antoine.C + atm.T_K)) * 1e5
    : Math.exp(23.196 - 3816.44 / (atm.T_K - 46.13));
  const x_w = Math.min(RH * Psat / atm.P_Pa, Psat / atm.P_Pa);

  const wet = {};
  for (const [sp, frac] of Object.entries(atm.air)) {
    wet[sp] = frac * (1 - x_w);
  }
  wet.H2O = x_w;
  return wet;
},

getDewPoint() {
  const atm = SimSettings.atmosphere;
  const wet = SimSettings.getWetAir();
  const x_H2O = wet.H2O || 0;
  if (x_H2O <= 0) return null;
  const P_H2O = x_H2O * atm.P_Pa;
  // Inverse Antoine approximation
  return 3816.44 / (23.196 - Math.log(P_H2O)) + 46.13;
}
```

**Backward compatible:** `RH: undefined` → `getWetAir()` returns
dry composition (existing behavior). Mars/Titan/Venus unaffected.

**source_air tick change (1 line):**

```javascript
// BEFORE:
for (const [sp, frac] of Object.entries(atm.air)) {
// AFTER:
const wetAir = SimSettings.getWetAir();
for (const [sp, frac] of Object.entries(wetAir)) {
```

**NNG:** NNG-1 (conservation: H₂O displaces dry air proportionally,
fractions still sum to 1.0). NNG-8 (Pa, K, mol fractions — all SI).

## 1.3 Atmospheric Info in Status Bar (30 min)

Read-only HUD showing planet conditions. Updates after every
solve and every atmosphere change.

```javascript
// New element in transport bar area:
const atmoHUD = el('div', { id: 'atmoHUD', style:
  'font-size:10px; opacity:0.6; display:flex; gap:8px; ' +
  'align-items:center; padding:0 8px;' });

function updateAtmoHUD() {
  const atm = SimSettings.getAtmosphere();
  const wet = SimSettings.getWetAir();
  const T_dp = SimSettings.getDewPoint();

  // Show key species above 0.01%
  const species = Object.entries(wet)
    .filter(([, f]) => f > 0.0001)
    .sort((a, b) => b[1] - a[1])
    .map(([sp, f]) => `${sp} ${(f * 100).toFixed(f > 0.01 ? 1 : 2)}%`);

  atmoHUD.innerHTML =
    `<span>${PLANET_ICONS[SimSettings.getPresetKey()] || '🪐'}</span>` +
    `<span>${(atm.T_K - 273.15).toFixed(0)}°C</span>` +
    `<span>${(atm.P_Pa / 1000).toFixed(1)} kPa</span>` +
    `<span style="opacity:0.5">${species.join(' · ')}</span>` +
    (T_dp ? `<span style="opacity:0.4">Dew ${(T_dp-273.15).toFixed(0)}°C</span>` : '');
}

// Call from: afterSolve(), applyPreset(), importJSON()
```

**Placement:** After the time display, before the step controls.
Always visible regardless of view mode.

**NNG:** NNG-13 (display only, no physics impact). NNG-11 (DOM
access is in UI block, not core).

## 1.4 Atmospheric Dashboard in Inspector (1 hour)

When no unit is selected, the properties panel shows an
atmospheric dashboard instead of being empty.

```javascript
function buildAtmoDashboard(container) {
  const atm = SimSettings.getAtmosphere();
  const wet = SimSettings.getWetAir();
  const T_dp = SimSettings.getDewPoint();
  const us = models.getActive('units');

  // ── Surface Conditions ──
  const condGrid = el('div', { class: 'ins-grid' });
  _addCondRow(condGrid, 'T surface', us.temperature.from(atm.T_K),
              us.temperature.symbol);
  _addCondRow(condGrid, 'P surface', us.pressure.from(atm.P_Pa),
              us.pressure.symbol);
  if (atm.RH != null) {
    _addCondRow(condGrid, 'Humidity', (atm.RH * 100).toFixed(0), '% RH');
  }
  if (T_dp) {
    _addCondRow(condGrid, 'Dew point', us.temperature.from(T_dp),
                us.temperature.symbol);
  }

  // ── Derived Properties ──
  const meanMW = Object.entries(wet).reduce((sum, [sp, f]) => {
    const cd = ComponentRegistry.get(sp);
    return sum + (cd ? cd.MW * f : 0);
  }, 0);
  const rho = atm.P_Pa * (meanMW / 1000) / (8.314 * atm.T_K);

  _addCondRow(condGrid, 'Mean MW', meanMW.toFixed(2), 'g/mol');
  _addCondRow(condGrid, 'Air density', rho.toFixed(3), 'kg/m³');
  container.appendChild(condGrid);

  // ── Composition Bars ──
  const compSection = el('div', { style: 'margin-top:8px;' });
  compSection.appendChild(el('div', {
    class: 'ins-section-header', html: 'Composition (wet basis)' }));

  const sorted = Object.entries(wet)
    .filter(([, f]) => f > 1e-6)
    .sort((a, b) => b[1] - a[1]);

  for (const [sp, frac] of sorted) {
    const row = el('div', { style:
      'display:grid; grid-template-columns:32px 1fr 48px; ' +
      'align-items:center; gap:4px; margin:2px 0; font-size:11px;' });
    row.appendChild(el('span', { html: sp, style: 'opacity:0.6' }));

    const barOuter = el('div', { style:
      'height:6px; background:#1e293b; border-radius:3px; overflow:hidden;' });
    const barInner = el('div', { style:
      `height:100%; width:${Math.min(frac * 100, 100)}%; ` +
      `background:${_SPECIES_COLOR[sp] || '#94a3b8'}; border-radius:3px;` });
    barOuter.appendChild(barInner);
    row.appendChild(barOuter);
    row.appendChild(el('span', {
      html: frac > 0.01 ? `${(frac*100).toFixed(1)}%`
                         : `${(frac*1e6).toFixed(0)} ppm`,
      style: 'text-align:right; opacity:0.5; font-size:10px;' }));
    compSection.appendChild(row);
  }
  container.appendChild(compSection);

  // ── Breathability Assessment ──
  const assess = el('div', { style: 'margin-top:8px; font-size:11px;' });
  assess.appendChild(el('div', {
    class: 'ins-section-header', html: 'Habitability' }));

  const co2_pct = (wet.CO2 || 0) * 100;
  const o2_pct = (wet.O2 || 0) * 100;

  const checks = [
    { label: 'O₂ level',
      value: `${o2_pct.toFixed(1)}%`,
      status: (o2_pct >= 19.5 && o2_pct <= 23.5) ? 'ok'
            : (o2_pct >= 16 && o2_pct <= 25) ? 'warn' : 'crit',
      note: o2_pct >= 19.5 && o2_pct <= 23.5
            ? 'Breathable range' : o2_pct > 23.5
            ? 'Fire hazard!' : 'Hypoxia risk' },
    { label: 'CO₂ level',
      value: `${co2_pct.toFixed(co2_pct > 1 ? 1 : 2)}%`,
      status: co2_pct < 0.5 ? 'ok' : co2_pct < 2 ? 'warn' : 'crit',
      note: co2_pct < 0.5 ? 'Safe' : co2_pct < 5
            ? 'Long-term health effects' : 'Lethal (narcosis)' },
    { label: 'Temperature',
      value: `${(atm.T_K - 273.15).toFixed(0)}°C`,
      status: (atm.T_K >= 273 && atm.T_K <= 318) ? 'ok'
            : (atm.T_K >= 253 && atm.T_K <= 333) ? 'warn' : 'crit',
      note: atm.T_K >= 273 && atm.T_K <= 318
            ? 'Survivable' : 'Extreme' },
    { label: 'Pressure',
      value: `${(atm.P_Pa / 101325).toFixed(2)} atm`,
      status: (atm.P_Pa >= 50000 && atm.P_Pa <= 200000) ? 'ok'
            : (atm.P_Pa >= 30000) ? 'warn' : 'crit',
      note: atm.P_Pa >= 50000 ? 'Adequate' : 'Pressure suit required' }
  ];

  const colors = { ok: '#34d399', warn: '#fbbf24', crit: '#ef4444' };
  for (const c of checks) {
    const row = el('div', { style:
      'display:flex; justify-content:space-between; padding:2px 0;' });
    row.innerHTML =
      `<span>${c.label}</span>` +
      `<span style="color:${colors[c.status]}">${c.value}</span>` +
      `<span style="opacity:0.4; font-size:10px;">${c.note}</span>`;
    assess.appendChild(row);
  }

  // ── Breathable verdict ──
  const breathable = co2_pct < 0.5 && o2_pct >= 19.5 && o2_pct <= 23.5
    && atm.P_Pa >= 50000 && atm.T_K >= 273 && atm.T_K <= 318;
  const verdict = el('div', { style:
    `text-align:center; margin-top:6px; padding:4px; ` +
    `border-radius:4px; font-size:11px; font-weight:600; ` +
    `background:${breathable ? '#065f4620' : '#7f1d1d20'}; ` +
    `color:${breathable ? '#34d399' : '#ef4444'};` });
  verdict.textContent = breathable
    ? '✓ BREATHABLE — Walk outside without a mask'
    : '✗ NOT BREATHABLE — ' + (co2_pct >= 5 ? 'CO₂ lethal'
      : co2_pct >= 0.5 ? 'CO₂ too high' : 'Check conditions');
  assess.appendChild(verdict);
  container.appendChild(assess);

  // ── Your Impact (placeholder, zeros until S-TERRAFORM Phase 3) ──
  const impact = el('div', { style:
    'margin-top:8px; opacity:0.3; font-size:10px; ' +
    'border-top:1px solid #334155; padding-top:6px;' });
  impact.innerHTML =
    '<div style="font-weight:600; margin-bottom:2px;">Your Impact</div>' +
    '<div>CO₂ removed: 0 mol</div>' +
    '<div>O₂ released: 0 mol</div>' +
    '<div style="opacity:0.5; margin-top:2px;">Deploy processes to ' +
    'change atmospheric composition</div>';
  container.appendChild(impact);
}

// Hook into properties panel: when selection is empty, show dashboard
// In updatePropertiesPanel():
if (!selectedUnit) {
  buildAtmoDashboard(propertiesPanel);
  return;
}
```

**NNG:** NNG-13 (inspector section ordering not affected — this is
a separate panel state). NNG-11 (DOM in UI block only).

## 1.5 Tests (Phase 1)

| ID | Test | Assertion |
|---|---|---|
| T-TF01 | Gas turbine default Pout matches atmosphere | `u.params.Pout === SimSettings.atmosphere.P_Pa` |
| T-TF02 | Valve default Pout matches atmosphere | Same |
| T-TF03 | source_multi default composition matches atmosphere | `deepEqual(u.params.n, SimSettings.atmosphere.air)` |
| T-TF04 | getWetAir on Planet X includes H₂O | `wet.H2O > 0.02 && wet.H2O < 0.03` |
| T-TF05 | getWetAir on Mars returns dry | `wet.H2O === undefined \|\| wet.H2O === 0` |
| T-TF06 | Wet fractions sum to 1.0 | `Math.abs(sum - 1.0) < 1e-10` |
| T-TF07 | getDewPoint on Planet X returns ~293K | `Math.abs(dp - 293) < 3` |
| T-TF08 | source_air emits wet composition | `ports.out.n.H2O > 0` on Planet X |

8 tests, ~30 assertions. Regression gate: current + 8.

---

# PHASE 2: NEAR-FUTURE (post S5-lite, ~1 week)

Atmospheric tracking becomes live. Plant emissions/intake tallied.
Dashboard shows real numbers. No atmosphere mutation yet.

## 2.1 Plant-to-Atmosphere Flow Tracking

After every solve, scan all units and tally what flows TO and FROM
the planet atmosphere.

**What counts as atmospheric exchange:**

A sink that receives material → emission to atmosphere.
A source_air that emits → intake from atmosphere.
(Regular `source` with explicit composition → NOT atmospheric.)
Vent reservoirs → natural source (geological).

```javascript
// New function, called from afterSolve():
function computeAtmosphericExchange(scene) {
  const exchange = {
    toAtm: {},      // species → mol/s emitted by player's sinks
    fromAtm: {},    // species → mol/s drawn by source_air
    ventToAtm: {},  // species → mol/s from geological vents
    net: {}         // species → mol/s net change (positive = accumulation)
  };

  for (const [uid, u] of scene.units) {
    const def = UnitRegistry.get(u.defId);
    if (!def) continue;

    if (u.defId === 'sink' && u.last?.stream?.n) {
      // Material entering a sink leaves the process → to atmosphere
      for (const [sp, rate] of Object.entries(u.last.stream.n)) {
        exchange.toAtm[sp] = (exchange.toAtm[sp] || 0) + rate;
      }
    }

    if (u.defId === 'source_air' && u.last) {
      // Air source draws from atmosphere
      const flowScale = u.params.flowScale ?? 1.0;
      const wet = SimSettings.getWetAir();
      for (const [sp, frac] of Object.entries(wet)) {
        exchange.fromAtm[sp] = (exchange.fromAtm[sp] || 0) + frac * flowScale;
      }
    }

    if (u.defId === 'reservoir' && u.last?.outFlow?.n) {
      // Vents are geological — separate category
      for (const [sp, rate] of Object.entries(u.last.outFlow.n)) {
        exchange.ventToAtm[sp] = (exchange.ventToAtm[sp] || 0) + rate;
      }
    }
  }

  // Net per species
  const allSp = new Set([
    ...Object.keys(exchange.toAtm),
    ...Object.keys(exchange.fromAtm),
    ...Object.keys(exchange.ventToAtm)
  ]);
  for (const sp of allSp) {
    exchange.net[sp] = (exchange.toAtm[sp] || 0)
                     - (exchange.fromAtm[sp] || 0)
                     + (exchange.ventToAtm[sp] || 0);
  }

  return exchange;
}

// Store on scene for dashboard access:
scene._lastAtmExchange = computeAtmosphericExchange(scene);
```

**NNG:** NNG-9 (reads only u.last and u.params — post-solve data,
not during tick). NNG-1 (pure accounting, no mass created).

## 2.2 Live "Your Impact" Section

Replace the placeholder in `buildAtmoDashboard`:

```javascript
const ex = scene._lastAtmExchange;
if (ex) {
  const co2_net = ex.net.CO2 || 0;  // mol/s, positive = adding to atm
  const o2_net = ex.net.O2 || 0;
  const h2o_net = ex.net.H2O || 0;

  const fmt_rate = (v) => {
    const abs = Math.abs(v);
    if (abs < 0.001) return '~0';
    if (abs < 1) return v.toFixed(3) + ' mol/s';
    if (abs < 1000) return v.toFixed(1) + ' mol/s';
    return (v / 1000).toFixed(1) + ' kmol/s';
  };

  impact.innerHTML =
    '<div style="font-weight:600; margin-bottom:4px;">Your Impact</div>' +
    `<div>CO₂: ${co2_net > 0 ? '↑' : '↓'} ${fmt_rate(co2_net)}</div>` +
    `<div>O₂:  ${o2_net > 0 ? '↑' : '↓'} ${fmt_rate(o2_net)}</div>` +
    `<div>H₂O: ${h2o_net > 0 ? '↑' : '↓'} ${fmt_rate(h2o_net)}</div>`;

  // Time to milestone (assuming constant rate, Earth-sized planet)
  if (co2_net < 0) {
    const co2_moles_atm = 0.08 * 1.54e20;  // current CO₂ inventory
    const co2_target = 0.005 * 1.54e20;     // 0.5% target
    const to_remove = co2_moles_atm - co2_target;
    const seconds = to_remove / Math.abs(co2_net);
    const years = seconds / (365.25 * 86400);

    impact.innerHTML += `<div style="margin-top:4px; opacity:0.5;">` +
      `At this rate: CO₂ < 0.5% in ${years.toFixed(0)} years</div>`;
  }
}
```

Even at survival scale, this shows something like:
"CO₂: ↑ 0.84 mol/s" (human exhaust going to atmosphere via sink).
Not terraforming, but the player sees the mechanism.

## 2.3 Atmospheric Preset Extension

Add planetary parameters needed for terraforming math:

```javascript
planet_x: {
  name: 'Planet X', T_K: 305.15, P_Pa: 89660, RH: 0.50,
  air: { N2: 0.70, O2: 0.21, CO2: 0.08, Ar: 0.01 },

  // Planetary physical parameters (display/calculation only)
  R_m: 6.371e6,          // Earth radius (design decision: Earth-sized)
  g: 9.81,               // m/s²
  A_m2: 5.1e14,          // surface area
  atm_mol_total: 1.54e20 // total atmospheric moles (derived, stored for perf)
}
```

Other presets get equivalent fields. These are read-only constants
used by the dashboard and future tickAtmosphere(). They do NOT
affect any tick function or solver behavior.

---

# PHASE 3: MID-TERM (post S-SIM, ~2 weeks)

Dynamic atmosphere. Blueprint deployment. The numbers move.

## 3.1 Mutable Atmosphere

Remove Object.freeze. Atmosphere becomes a live mutable object
updated once per tick by `tickAtmosphere()`.

```javascript
// Replace in _applyPreset():
SimSettings.atmosphere = {      // no freeze
  T_K: src.T_K,
  P_Pa: src.P_Pa,
  air: { ...src.air },
  RH: src.RH ?? 0,
  presetName: src.name || 'Custom',

  // Dynamic inventory (total moles per species)
  inventory: {},

  // Cumulative tracking
  totalRemoved: {},    // mol removed since game start
  totalAdded: {}       // mol added since game start
};

// Initialize inventory from composition + total moles
const total = src.atm_mol_total || 1.54e20;
for (const [sp, frac] of Object.entries(src.air)) {
  SimSettings.atmosphere.inventory[sp] = frac * total;
}
```

## 3.2 tickAtmosphere()

Called once per timestep, AFTER all unit ticks and solves.
Reads atmospheric exchange from units, updates inventory,
recomputes composition and pressure.

```javascript
function tickAtmosphere(dt, scene) {
  const atm = SimSettings.atmosphere;
  const planet = SimSettings.atmospherePresets[SimSettings.getPresetKey()];
  if (!planet.atm_mol_total) return;  // static preset, no terraforming

  const ex = scene._lastAtmExchange;
  if (!ex) return;

  // ── Species balance ──
  for (const [sp, netRate] of Object.entries(ex.net)) {
    const delta = netRate * dt;  // mol added this tick
    atm.inventory[sp] = Math.max(0, (atm.inventory[sp] || 0) + delta);

    // Cumulative tracking
    if (delta > 0) atm.totalAdded[sp] = (atm.totalAdded[sp] || 0) + delta;
    if (delta < 0) atm.totalRemoved[sp] = (atm.totalRemoved[sp] || 0) - delta;
  }

  // ── Recompute composition ──
  let n_total = 0;
  for (const n of Object.values(atm.inventory)) n_total += n;

  const newAir = {};
  for (const [sp, n] of Object.entries(atm.inventory)) {
    newAir[sp] = n / n_total;
  }
  atm.air = newAir;

  // ── Recompute surface pressure ──
  // P = n_total × R × T / V_atm
  // But V_atm ≈ scale_height × A. Scale height = RT/(Mg).
  // Simpler: P proportional to total moles (constant T, g, A).
  // P_new = P_initial × (n_total / n_initial)
  atm.P_Pa = planet.P_Pa * (n_total / planet.atm_mol_total);

  // ── Greenhouse temperature feedback (simplified) ──
  // T depends on CO₂ via greenhouse effect.
  // Logarithmic forcing: ΔT = λ × 5.35 × ln(CO₂_new / CO₂_ref)
  // Climate sensitivity λ ≈ 0.8 K/(W/m²) (Earth-like)
  const co2_frac = newAir.CO2 || 0.0004;
  const co2_ref = 0.08;  // Planet X initial
  const forcing = 5.35 * Math.log(co2_frac / co2_ref);  // W/m²
  const lambda = 0.8;  // K per W/m²
  atm.T_K = planet.T_K + lambda * forcing;

  // ── Humidity follows temperature ──
  // RH stays constant (simplification), but x_H2O changes with T
  // because Psat changes. getWetAir() handles this automatically.
}
```

**NNG:** NNG-1 (conservation: Δn = rate × dt, no mass created).
NNG-9 (tickAtmosphere reads scene._lastAtmExchange computed
post-solve, not during unit ticks). NNG-8 (all SI: Pa, K, mol).

## 3.3 Blueprint Deployment System

### Relationship to S8 (Groups & Templates)

S8 and blueprints operate at different scales. S8 is unchanged.

| | S8 Group Template | Terraform Blueprint |
|---|---|---|
| Registry | GroupTemplateRegistry | BlueprintRegistry (new) |
| Scope | Sub-assembly within ONE flowsheet | Entire scene (flowsheet) |
| Instantiation | Creates real units + connections on canvas | Creates NO units — stores a multiplied commodity bill |
| Player edits | Tab into group, edit internal units | Opens blueprint's stored scene as separate flowsheet |
| Solver | Sees individual units (transparent) | Solved ONCE for the template scene; never per-copy |
| Multiplier | scaleRules (racks, population) | ×N copies (arbitrary integer) |
| Physics | Full simulation every tick | Scaled from validated snapshot |

They compose naturally: a blueprint's scene may contain S8
groups internally (e.g., a "Power Block" group inside a BECCS
flowsheet). S8 handles intra-scene organization. Blueprints
handle inter-scene planetary scaling. No overlap, no conflict.

### Multi-Scene Management

Blueprints require the player to work on multiple scenes: one
"active" scene (currently displayed and simulated) and N stored
blueprint scenes (frozen, re-openable for editing).

```
Scene management UI:

  📋 Active: "My Base" (survival plant — always simulated)
  🏭 Blueprint: "BECCS Train v2"  ×50,000  [Edit] [×]
  🏭 Blueprint: "NH₃ Plant"       ×100     [Edit] [×]
  🏭 Blueprint: "Nuclear Power"   ×4,294   [Edit] [×]
  ⊕  New Flowsheet / Deploy Current
```

Clicking [Edit] loads the blueprint's stored scene JSON into the
editor (replacing active view). Player edits, re-solves, saves.
The commodity bill updates. All N copies reflect the change.
Clicking "My Base" returns to the survival plant.

The active scene is always fully simulated (ticks, solver, alarms).
Blueprint scenes are only simulated when open for editing. Their
atmospheric contribution comes from the stored commodity bill × N,
not from live simulation.

Serialization: `exportJSON` stores active scene + all blueprint
entries (scene JSON + bill + count). Round-trips cleanly.

### Blueprint Capture and Commodity Bill

The player designs a process on the flowsheet. Proves it works.
Clicks "Deploy as Blueprint." Enters a count. The atmospheric
exchange is multiplied.

```javascript
// New data structure (separate from S8 GroupTemplateRegistry):
const BlueprintRegistry = {
  _blueprints: new Map(),

  /**
   * Deploy a scene as a planetary blueprint.
   * Captures the commodity bill from the last solve.
   * Stores full scene JSON for re-editing.
   */
  deploy(id, name, scene, count) {
    const exchange = computeAtmosphericExchange(scene);
    const bill = classifyBlueprintStreams(scene);
    const powerBalance = computePowerBalance(scene);

    this._blueprints.set(id, Object.freeze({
      name,
      sceneJSON: scene.exportJSON(),    // full scene for re-editing
      exchange: { ...exchange.net },     // mol/s per species (atmospheric)
      bill,                              // internal commodities (must balance)
      powerNet_W: powerBalance.net,      // net power (negative = consumer)
      count
    }));
  },

  setCount(id, count) {
    const bp = this._blueprints.get(id);
    if (bp) this._blueprints.set(id, Object.freeze({ ...bp, count: Math.max(0, count) }));
  },

  /**
   * Open a blueprint for editing. Returns a Scene.
   * After editing + re-solving, call updateFromScene().
   */
  getScene(id) {
    const bp = this._blueprints.get(id);
    if (!bp) return null;
    const scene = new Scene();
    scene.importJSON(bp.sceneJSON);
    return scene;
  },

  /**
   * Re-capture commodity bill after editing a blueprint's scene.
   */
  updateFromScene(id, scene) {
    const bp = this._blueprints.get(id);
    if (!bp) return;
    const exchange = computeAtmosphericExchange(scene);
    const bill = classifyBlueprintStreams(scene);
    const powerBalance = computePowerBalance(scene);
    this._blueprints.set(id, Object.freeze({
      ...bp,
      sceneJSON: scene.exportJSON(),
      exchange: { ...exchange.net },
      bill,
      powerNet_W: powerBalance.net
    }));
  },

  remove(id) { this._blueprints.delete(id); },
  all() { return [...this._blueprints.values()]; },

  getTotalExchange() {
    const total = {};
    for (const bp of this._blueprints.values()) {
      for (const [sp, rate] of Object.entries(bp.exchange)) {
        total[sp] = (total[sp] || 0) + rate * bp.count;
      }
    }
    return total;
  }
};

// In computeAtmosphericExchange, add blueprint contributions:
const bpExchange = BlueprintRegistry.getTotalExchange();
for (const [sp, rate] of Object.entries(bpExchange)) {
  exchange.net[sp] = (exchange.net[sp] || 0) + rate;
}
```

**How exchangePerCopy is captured:**

When the player clicks "Deploy as Blueprint," the system runs one
solve of the current scene and reads `scene._lastAtmExchange.net`.
That's the per-copy atmospheric exchange rate. Stored with the
blueprint. If the player edits the flowsheet later and re-deploys,
the exchange rate updates.

**The Deploy panel:**

```
┌─ Deployed Blueprints ──────────────────────┐
│                                            │
│  "DAC-BECCS Train v2"       ×50,000       │
│   CO₂: −0.48 mol/s/copy                  │
│   O₂:  ±0.00 mol/s/copy                  │
│   Power: 45 kW/copy → 2.25 TW total      │
│   [Edit Flowsheet] [× count] [Delete]     │
│                                            │
│  "O₂ Boost Photosynthesis"  ×500          │
│   CO₂: −0.12 mol/s/copy                  │
│   O₂:  +0.12 mol/s/copy                  │
│   Power: 42 kW/copy → 21 GW total        │
│   [Edit Flowsheet] [× count] [Delete]     │
│                                            │
│  [+ Deploy Current Flowsheet]              │
└────────────────────────────────────────────┘
```

**Power accounting for blueprints:**

Each blueprint has a power demand per copy. The total power demand
across all blueprints is displayed. Power SUPPLY blueprints
(nuclear plant, solar thermal) have negative power demand (they
produce). The player must ensure total power is balanced.

This is NOT simulated in the engine — it's a separate accounting
layer. The flowsheet simulation validates the DESIGN works. The
blueprint multiplier scales the validated numbers. No need to
simulate 50,000 copies.

**NNG:** NNG-3 (WYSIWYG: the blueprint exchange comes from actual
solver output, not fabricated numbers). NNG-1 (conservation: the
multiplied rates are exact multiples of validated per-copy rates).

### Commodity Balance Across Blueprints

Atmospheric commodities (CO₂, O₂, N₂, H₂O, Ar) use the planet
as an infinite buffer — they don't need to balance between
blueprints. Internal commodities (NH₃, CH₄, H₂, CH₂O, power)
MUST be supplied by other blueprints.

```javascript
function computePlanetaryBalance() {
  const balance = {};
  const ATMOSPHERIC = new Set(['CO2', 'O2', 'N2', 'Ar', 'H2O']);

  for (const bp of BlueprintRegistry.all()) {
    for (const [commodity, rate] of Object.entries(bp.bill.consumes)) {
      if (!balance[commodity]) balance[commodity] = { supply: 0, demand: 0 };
      balance[commodity].demand += rate * bp.count;
    }
    for (const [commodity, rate] of Object.entries(bp.bill.produces)) {
      if (!balance[commodity]) balance[commodity] = { supply: 0, demand: 0 };
      balance[commodity].supply += rate * bp.count;
    }
  }

  for (const [commodity, bal] of Object.entries(balance)) {
    bal.isAtmospheric = ATMOSPHERIC.has(commodity);
    bal.net = bal.supply - bal.demand;
    bal.status = bal.isAtmospheric ? 'atm'
      : bal.net >= 0 ? 'ok' : 'deficit';
    if (!bal.isAtmospheric && bal.net < 0) {
      bal.curtailment = bal.supply / bal.demand;  // 0–1
    }
  }
  return balance;
}
```

**Commodity classification** uses the existing source/sink
architecture (NNG-3: WYSIWYG). Sources without upstream =
blueprint input requirement. Sinks without downstream = blueprint
output. source_air = atmospheric draw. Atmospheric sinks are
identified by what species they emit.

```javascript
function classifyBlueprintStreams(scene) {
  const bill = { consumes: {}, produces: {} };

  for (const [uid, u] of scene.units) {
    // source_air → atmospheric draw (not an internal commodity)
    if (u.defId === 'source_air') continue;

    // Sink → output (atmospheric or internal depending on species)
    if (u.defId === 'sink' && u.last?.stream?.n) {
      for (const [sp, rate] of Object.entries(u.last.stream.n)) {
        bill.produces[sp] = (bill.produces[sp] || 0) + rate;
      }
    }

    // Source (non-air) with explicit composition → input requirement
    if ((u.defId === 'source' || u.defId === 'source_multi') && u.last) {
      for (const [sp, rate] of Object.entries(u.last.n || {})) {
        bill.consumes[sp] = (bill.consumes[sp] || 0) + rate;
      }
    }
  }

  // Power: net from electrical hub balance
  bill.consumes.POWER_W = scene._lastPowerDemand || 0;
  bill.produces.POWER_W = scene._lastPowerSupply || 0;

  return bill;
}
```

**Deficit handling:**

| Commodity type | Deficit response |
|---|---|
| Atmospheric | Never — planet is buffer |
| Power | Proportional curtailment (same as NNG-5 within a scene) |
| Internal material | Red warning on commodity panel; player must deploy more supply blueprints or reduce demand count |

Power curtailment is automatic (consistent with existing engine).
Material deficits are manual — the player solves the supply chain.
This IS the late-game engineering puzzle: capacity planning across
interdependent processes.

**Commodity Balance Panel (UI):**

```
┌─ Planetary Commodity Balance ──────────────────────────────┐
│                                                            │
│  ATMOSPHERIC (planet buffer)                               │
│  CO₂   draw: 24,000 mol/s   release: 0       net: −24k   │
│  O₂    draw: 200            release: 180      net: −20    │
│  H₂O   draw: 8,000          release: 16,000   net: +8k   │
│                                                            │
│  INTERNAL (must balance)                      Status       │
│  NH₃   supply: 120 mol/s   demand: 96        ✓ surplus    │
│  CH₄   supply: 400         demand: 355       ✓ surplus    │
│  Power  supply: 2.4 TW     demand: 2.1 TW   ✓ +300 GW   │
│                                                            │
│  ⚠ No deficits. All blueprints at 100%.                   │
└────────────────────────────────────────────────────────────┘
```

## 3.4 Atmospheric Milestones

Triggered by `tickAtmosphere` checking thresholds:

| Milestone | Condition | Message | Game effect |
|---|---|---|---|
| First Dent | CO₂ < 7.9% | "Your processes are changing the atmosphere." | Morale boost |
| Percent Down | CO₂ < 7.0% | "One percent removed. The sky is shifting." | Sky color begins changing |
| O₂ Warning | O₂ > 23% | "⚠ Oxygen levels approaching fire hazard." | PLANT alarm |
| Half CO₂ | CO₂ < 4.0% | "Halfway. Outdoors survivable with light mask." | Unlock outdoor plots (future) |
| Almost Breathable | CO₂ < 0.5% | "CO₂ approaching safe levels." | Dashboard goes green |
| Breathable | CO₂ < 0.04%, O₂ 19.5–23.5% | "The air is breathable. Walk outside." | Victory |

## 3.5 Serialization

Export/import must capture atmospheric state:

```javascript
// In exportJSON:
data.atmosphere = {
  inventory: { ...SimSettings.atmosphere.inventory },
  totalRemoved: { ...SimSettings.atmosphere.totalRemoved },
  totalAdded: { ...SimSettings.atmosphere.totalAdded }
};
data.blueprints = Array.from(BlueprintRegistry._blueprints.entries())
  .map(([id, bp]) => ({ id, ...bp }));

// In importJSON:
if (data.atmosphere?.inventory) {
  Object.assign(SimSettings.atmosphere.inventory, data.atmosphere.inventory);
  // Recompute composition and pressure from inventory
  // (call tickAtmosphere with dt=0 to refresh derived values)
}
if (data.blueprints) {
  for (const bp of data.blueprints) {
    BlueprintRegistry.deploy(bp.id, bp.name, bp.exchangePerCopy, bp.count);
  }
}
```

---

# PHASE 4: LONG-TERM (principles, sizing, design direction)

## 4.1 The Three CO₂ Removal Pathways

All three use existing or planned equipment. The player discovers
which to use through the O₂ constraint.

### Path A: Direct Air Capture + Mineral Carbonation (O₂ neutral)

```
Atmosphere → [Concentrator] → CO₂ stream
  → [Reactor: CO₂ + mineral → carbonate] → solid waste (stored)

Net: −CO₂, ±O₂
Power: ~400 kJ/mol CO₂ (thermodynamic + compression)
Equipment: source_air, compressor, reactor (new reaction), sink
```

New reaction needed:

```javascript
R_MINERAL_CARB: {
  equation: 'CO₂ + MgSiO₃ → MgCO₃ + SiO₂',
  stoich: { CO2: -1, MgSiO3: -1, MgCO3: 1, SiO2: 1 },
  dH: -81000  // exothermic — releases heat
}
```

Requires new species: MgSiO₃ (olivine), MgCO₃, SiO₂.
These are solids — new phase behavior needed (future).
Can be simplified: CO₂ goes into a "mineral sink" that reports
sequestration without modeling solid chemistry. Pragmatic first.

### Path B: BECCS — Bio-Energy with Carbon Capture (O₂ neutral)

```
Atmosphere → [DAC] → CO₂
  → [Greenhouse: CO₂+H₂O → CH₂O+O₂] ← power
    → food_out: CH₂O
      → [Combustor: CH₂O+O₂ → CO₂+H₂O] → heat → [Turbine] → power!
        → exhaust CO₂
          → [Compressor] → underground/storage (sink)

O₂ loop: Greenhouse produces O₂ → Combustor consumes O₂ → net zero
CO₂ removed: greenhouse captures from atmosphere, combustor CO₂ stored
Energy: partially recovered from combustion
```

All equipment exists in engine. The player designs this train.
The O₂ from greenhouse.air_out routes to combustor.O₂_in.
Self-contained O₂ loop. Beautiful engineering.

### Path C: Photosynthesis + Sequestration (adds O₂)

```
Greenhouse: CO₂+H₂O → CH₂O+O₂
Sequester CH₂O (bury/pyrolyze)

Net: −CO₂, +O₂
```

Only viable while O₂ < 23.5%. Budget: 2.5% of atmosphere.
Player uses this early, then must switch to A or B.

### Decision Matrix (the game!)

```
                 O₂ < 23.5%     O₂ ≥ 23.5%
              ┌──────────────┬──────────────┐
Path A (DAC)  │ ✓ always ok  │ ✓ always ok  │  O₂ neutral
Path B (BECCS)│ ✓ always ok  │ ✓ always ok  │  O₂ neutral
Path C (Bio)  │ ✓ careful    │ ✗ STOP!      │  adds O₂
              └──────────────┴──────────────┘
```

**The player who figures out Path B is the engineer.**
They're recycling the O₂ internally AND recovering energy.
That's the elegant solution. The game rewards insight.

## 4.2 Power Budget for 100-Year Terraforming

```
Target: remove 1.226 × 10¹⁹ mol CO₂ in 100 years
Rate needed: 1.226e19 / (100 × 3.15e7) = 3.89 × 10⁹ mol/s

Path A (DAC + mineralization):
  ~400 kJ/mol → 3.89e9 × 400,000 = 1,556 TW

Path B (BECCS at η_greenhouse = 2%):
  Greenhouse power: 42 kW per 1.63e-3 mol/s CO₂
  → 25.8 MW per mol/s CO₂
  → 3.89e9 × 25.8e6 = 1.00 × 10¹⁷ W = too high (1e5 TW)

Path B (BECCS with SUNLIGHT):
  Outdoor greenhouse (free photons):
  Power for pumps/controls only: ~500 W per 1.63e-3 mol/s
  → 307 kW per mol/s CO₂
  → 3.89e9 × 307,000 = 1.19 × 10¹⁵ W = 1,190 TW

  MINUS energy recovery from combustion:
  CH₂O combustion: 519 kJ/mol × 3.89e9 mol/s = 2.02 × 10¹⁵ W
  At 40% power cycle efficiency: 808 TW recovered!

  Net power for BECCS with outdoor bio:
  1,190 − 808 = 382 TW  ← manageable with fission fleet

Path optimized:
  Phase 1 (indoor): mostly power-limited, slow
  Phase 2 (outdoor): sun does heavy lifting, combustion recovers energy
  Phase 3 (self-sustaining): biology dominant, minimal industrial input
```

## 4.3 Power Generation Progression (principles only)

No magic boxes. Every power source is a HOT STREAM that the player
builds a thermodynamic cycle around.

| Tier | Source | T_hot | Available | Engineering challenge |
|---|---|---|---|---|
| 1 | Solar thermal | 400–600K | Day 1 | Intermittent. Thermal storage. |
| 2 | Geothermal (vents) | 450–550K | Mid-game | 24/7 but limited sites. Brine fouling. |
| 3 | Fission (heat source) | 600–1100K | Late survival | Full steam cycle design. Safety. Cooling. |
| 4 | Orbital solar (rectenna) | N/A | Endgame | Commission-based. Constant power. |

Each is modeled as a heat source unit with T_out and Q_thermal.
The player designs turbines, condensers, cooling, feedwater systems.
Planet X's 305K ambient is a constraint — Carnot limits everything.

The nuclear heat source unit:

```javascript
UnitRegistry.register('heat_source', {
  name: 'Heat Source',
  ports: [
    { portId: 'coolant_in', dir: IN, type: MATERIAL },
    { portId: 'coolant_out', dir: OUT, type: MATERIAL }
  ],
  tick(u, ports, par) {
    const sIn = ports.coolant_in;
    if (!sIn?.n) { u.last = { error: ... }; return; }

    // Add Q_thermal to coolant stream
    const H_in = thermo.getHdot_Jps(sIn);
    ports.coolant_out = {
      type: StreamType.MATERIAL,
      P: sIn.P,
      n: { ...sIn.n },
      H_target_Jps: H_in + par.Q_thermal_W,
      phaseConstraint: 'VL'
    };

    u.last = { Q: par.Q_thermal_W, T_in: sIn.T, T_out: '(PH flash)' };
  }
});
```

Profiles: `heat_source_nuclear` (Q=500MW, T_max=873K),
`heat_source_geothermal` (Q=50MW, T_max=550K),
`heat_source_solar` (Q=5MW, T_max=600K, intermittent flag).

**NNG:** NNG-3 (each heat source is a physical unit — you can point
at a reactor vessel, a solar receiver, a wellhead). NNG-2 (heat
added to coolant via enthalpy, second law respected through Carnot
of downstream cycle). NNG-9 (tick reads only its own ports).

## 4.4 Greenhouse Temperature Feedback

As CO₂ drops, Planet X cools. The simplified model in
tickAtmosphere §3.2 uses logarithmic forcing:

```
Initial:  CO₂ = 8%, T = 305.15K
At 4%:    ΔT = 0.8 × 5.35 × ln(0.04/0.08) = −2.97K → T = 302.2K
At 1%:    ΔT = 0.8 × 5.35 × ln(0.01/0.08) = −8.89K → T = 296.3K
At 0.04%: ΔT = 0.8 × 5.35 × ln(0.0004/0.08) = −22.5K → T = 282.7K
```

| CO₂ | Mean T | ΔT from initial | Effect |
|---|---|---|---|
| 8.0% | 305.2 K (32°C) | 0 | Starting conditions |
| 4.0% | 302.2 K (29°C) | −3.0 | Slightly cooler nights |
| 2.0% | 299.2 K (26°C) | −6.0 | Pleasant |
| 1.0% | 296.3 K (23°C) | −8.9 | Temperate |
| 0.5% | 293.3 K (20°C) | −11.8 | Cool |
| 0.04% | 282.7 K (9.5°C) | −22.5 | Cold! Need H₂O vapor to maintain warmth |

The player who removes ALL CO₂ makes Planet X too cold! Water
vapor (greenhouse gas) partially compensates but not fully. The
optimal endpoint might be CO₂ at 0.04% + deliberate H₂O vapor
management. Or the player accepts a cooler planet. THESE ARE
REAL TERRAFORMING TRADEOFFS.

Day/night amplitude also increases as greenhouse effect weakens:

```
ΔT_diurnal ≈ 15K × (1 + 0.5 × (1 - CO₂_frac / 0.08))
  At 8% CO₂:    ΔT = ±15K  (night 290K, day 320K)
  At 0.04% CO₂: ΔT = ±22K  (night 261K, day 305K)
```

Colder nights → condensation on equipment (dew point crossed) →
water management changes → gameplay consequence of success.

## 4.5 Visual Feedback (ties to S-3D)

The sky color and atmospheric haze respond to composition:

```
Sky clarity = f(total_pressure, CO₂_fraction, H₂O_fraction)
  More CO₂ → more orange/amber scattering
  Less CO₂ → bluer sky (Rayleigh dominant)
  More H₂O → whiter/hazier

For CSS background or 3D sky shader:
  hue:       lerp(orange, blue, 1 - CO2_frac / 0.08)
  saturation: lerp(high, medium, H2O_frac / 0.05)
  brightness: lerp(dim, bright, 1 - CO2_frac / 0.10)
```

The player literally watches the sky change color over game-years
as they remove CO₂. That's the most visceral feedback possible.

## 4.6 Outdoor Biology (late game, principles only)

When CO₂ < 4% and T > 273K, outdoor planting becomes possible.
Modeled as a simple atmospheric reactor (no flowsheet ports):

```
fixation_rate = area_m2 × BASE_RATE
  × michaelis_menten(CO₂_frac, Km=0.001)
  × bell_curve(T, T_opt=295, σ=15)
  × daylight_fraction(t)
  × water_availability(RH)

BASE_RATE ≈ 5e-6 mol/(m²·s) at CO₂ saturation
(≈ 150 mol/m²/year, consistent with productive cropland)
```

Outdoor plots don't appear on the flowsheet. They're a planetary-
scale mechanism managed through the Deploy panel: "Plant X hectares."
Each hectare contributes to atmospheric exchange via the same
tickAtmosphere pathway.

## 4.7 Endgame: Self-Sustaining Biosphere

Victory condition: the atmospheric exchange is NET ZERO without
any player blueprints active. Biology + weathering maintain CO₂
at breathable levels. The player can turn off all industrial
processes and the planet breathes on its own.

```
Self-sustaining when:
  biological_fixation + weathering ≥ volcanic_outgassing
  AND CO₂ in [0.03%, 0.06%]
  AND O₂ in [19.5%, 23.5%]
  AND T_mean in [275K, 300K]
```

The player didn't just survive. They built a biosphere.

---

# 5. Implementation Roadmap Summary

| Phase | When | Scope | Key deliverables |
|---|---|---|---|
| **1: IMMEDIATE** | S5a-0 | Display only | HUD, dashboard, RH, hardcode fixes, 8 tests |
| **2: NEAR** | Post S5-lite | Tracking | Atmospheric exchange accounting, live "Your Impact" |
| **3: MID** | Post S-SIM | Dynamic | tickAtmosphere, blueprints, milestones, serialization |
| **4: LONG** | Post vertical slice | Endgame | BECCS flowsheet, power tiers, outdoor bio, visual feedback |

Each phase is independently valuable:
- Phase 1 makes the planet feel alive (information).
- Phase 2 shows the player's impact (awareness).
- Phase 3 lets the player change the world (agency).
- Phase 4 gives them something to aim for (purpose).

---

# 6. Key Design Decisions (for context in future sessions)

1. **Planet X has 21% O₂.** Terraforming is a CO₂ removal problem,
   not an O₂ generation problem. This makes BECCS the optimal
   pathway and creates a meaningful O₂ management constraint.

2. **Earth-sized, Earth-gravity.** Player intuition preserved.
   Water boils at ~96°C (close enough). 1 bar ≈ normal.

3. **Blueprints are flowsheet snapshots × N.** No artificial
   S→M→L gates. Design at any scale, deploy any count. The
   atmospheric exchange is the validated per-copy rate × count.
   Blueprints store full scene JSON for re-editing. Updating a
   blueprint's flowsheet updates all N copies instantly.

4. **S8 is unchanged. Blueprints are a separate layer.** S8
   groups organize units within ONE flowsheet. Blueprints deploy
   entire flowsheets at planetary scale. They compose: a
   blueprint's scene may contain S8 groups internally. S8 handles
   intra-scene organization, blueprints handle inter-scene scaling.
   Different registries, different purposes, no overlap.

5. **Multi-scene management.** One "active" scene is always fully
   simulated. Blueprint scenes are stored as JSON, loaded into the
   editor on demand. Only the active scene ticks. Blueprint
   atmospheric contributions come from stored commodity bills × N.

6. **Power is never magic.** Every power source is a hot stream.
   The player designs the thermodynamic cycle. Planet X's 305K
   ambient is a real Carnot constraint that improves as they cool
   the planet.

7. **Internal commodities must balance across blueprints.** NH₃,
   H₂, CH₄, power — if blueprints consume more than other
   blueprints produce, the player sees a deficit and must fix
   the supply chain. Atmospheric commodities use the planet as
   an infinite buffer.

8. **Three CO₂ pathways with O₂ constraint.** Mineralization
   (O₂ neutral), BECCS (O₂ neutral + energy), photosynthesis +
   sequestration (adds O₂). The player must use a mix, driven
   by the O₂ gauge. This IS the game.

9. **Temperature feedback is physical.** Removing CO₂ cools the
   planet via reduced greenhouse effect. The player can overshoot
   and make it too cold. Real tradeoff.

10. **Vents are a CO₂ source.** The planet fights back. Volcanic
    outgassing continuously adds CO₂. Terraforming must overcome
    the geological baseline. Permanent victory requires biological
    sinks that match volcanic sources.

11. **Victory = self-sustaining biosphere.** Not "enough machines."
    The endgame is when nature takes over and maintains the
    atmosphere without industrial input.
