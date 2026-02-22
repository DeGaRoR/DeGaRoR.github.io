# PTIS_S7_SPEC
## S7 — Performance Maps & Visualization
### processThis v13.6.0 → v13.7.0 (post-S6)

---

## Overview

**What:** Visual performance infrastructure and six map types embedded
in the inspector. Shared rendering trunk (HiDPI canvas, axes, pointer
tracking, color scales), then curve maps (VP envelopes, bubble/dew
boundaries), field maps (reactor feasibility T×P → conversion%), limit
region overlays, and column operating map. Plus alarm rationalization
skeleton.

**Sub-sessions:** S7a (2), S7b (2) — 4 sessions total.

**Risk:** Low-medium. Mostly DOM/canvas rendering (Block 2). Physics
computations are lightweight (VP from Antoine/PR, reactor grid from
existing equilibrium solver). No changes to core simulation logic.

**Dependencies:**
- S1 (limit data for overlays, `evaluateLimits()`, `getEffectiveLimits()`)
- S3 (PR EOS for VP envelopes, bubble/dew from fugacity)
- S4 (distillation_column for Gilliland operating map)
- S6 optional (electrochemical reactor map: conversion vs power)

**Required by:** S8 (maps provide visual feedback during game missions).

**Baseline state (post-S6):**
- No performance map rendering infrastructure
- No canvas utilities for maps
- Limit data exists (S1) but no visual overlays
- AlarmSystem._rationalize() is a skeleton (S1)
- ~442 tests

**After S7:**
- Full rendering infrastructure (pm-* CSS, HiDPI canvas, axes, pointer)
- 6 map types (PM-1 through PM-6) + column operating map
- Limit overlays on all applicable maps
- Alarm rationalization (dedup by id)
- Inspector hooks on 7 unit types
- ~447 tests (442 + 5 new)

---

## Governing Spec Mapping

The governing spec (`RELEASESPEC_heatStream_perfmaps.md`) defines 8
implementation phases. Their status relative to this consolidation:

| Gov Phase | Content | Status |
|-----------|---------|--------|
| 0 | Heat stream deletion | ✅ Done in v12 |
| 1 | Rendering infrastructure | **S7a** |
| 2 | Limits + alarm source + data | ✅ Done in S1 |
| 3 | Species VP envelopes (PM-1) | **S7a** |
| 4 | Dynamic phase maps (PM-2, PM-3) | **S7b** |
| 5 | Reactor feasibility maps (PM-4, PM-5) | **S7b** |
| 6 | Alarm rationalization | **S7a** |
| 7 | Limit overlays + column map + inspector hooks | **S7b** |

S7 delivers Phases 1, 3, 4, 5, 6, 7.

---

# S7a — Rendering Infrastructure + VP Envelopes + Alarm Rationalization

**Sessions:** 2 (rendering trunk + VP curves, then alarm rationalization).

## S7a-1. CSS Classes (pm-*)

```css
/* Performance Map — embedded in inspector detail panel */
.pm-container { position: relative; width: 100%; aspect-ratio: 4/3;
  border: 1px solid var(--border); border-radius: 4px; overflow: hidden;
  cursor: crosshair; }
.pm-container canvas { width: 100%; height: 100%; display: block; }
.pm-readout { position: absolute; top: 4px; right: 6px;
  font-size: 11px; color: var(--text-muted); pointer-events: none;
  font-family: var(--mono); }
.pm-legend { display: flex; flex-wrap: wrap; gap: 4px 12px;
  padding: 4px 0; font-size: 11px; }
.pm-legend-item { display: flex; align-items: center; gap: 4px; }
.pm-legend-swatch { width: 14px; height: 3px; border-radius: 1px; }
.pm-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.pm-expand-btn { position: absolute; top: 4px; left: 6px;
  font-size: 10px; opacity: 0.5; cursor: pointer; }
.pm-expand-btn:hover { opacity: 1; }

/* Expanded modal */
.pm-modal { position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.6); display: flex; align-items: center;
  justify-content: center; }
.pm-modal-inner { width: 80vw; max-width: 900px; aspect-ratio: 4/3;
  background: var(--bg); border-radius: 8px; padding: 16px;
  position: relative; }
```

---

## S7a-2. Canvas Setup + HiDPI

```javascript
/**
 * Create and configure a HiDPI-aware canvas for performance maps.
 * @param {HTMLElement} container - Parent element (.pm-container)
 * @returns {{ canvas, ctx, W, H, dpr }}
 */
function pmSetupCanvas(container) {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const W = rect.width, H = rect.height;

  let canvas = container.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  }
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  return { canvas, ctx, W, H, dpr };
}
```

---

## S7a-3. Axis Layout + Drawing

```javascript
/** Standard margins [px]: top, right, bottom, left */
const PM_MARGINS = { t: 20, r: 15, b: 40, l: 55 };

/**
 * Compute axis layout for a given data range.
 * @param {number} W, H - Canvas CSS dimensions
 * @param {{ min, max, log }} xAxis - X axis config
 * @param {{ min, max, log }} yAxis - Y axis config
 * @returns {{ plotX, plotY, plotW, plotH, xScale, yScale, xInv, yInv }}
 */
function pmAxisLayout(W, H, xAxis, yAxis) {
  const m = PM_MARGINS;
  const plotX = m.l, plotY = m.t;
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;

  const xScale = xAxis.log
    ? v => plotX + plotW * (Math.log10(v) - Math.log10(xAxis.min))
            / (Math.log10(xAxis.max) - Math.log10(xAxis.min))
    : v => plotX + plotW * (v - xAxis.min) / (xAxis.max - xAxis.min);

  const yScale = yAxis.log
    ? v => plotY + plotH * (1 - (Math.log10(v) - Math.log10(yAxis.min))
            / (Math.log10(yAxis.max) - Math.log10(yAxis.min)))
    : v => plotY + plotH * (1 - (v - yAxis.min) / (yAxis.max - yAxis.min));

  // Inverse transforms (for pointer readout)
  const xInv = px => xAxis.log
    ? Math.pow(10, Math.log10(xAxis.min) + (px - plotX) / plotW
        * (Math.log10(xAxis.max) - Math.log10(xAxis.min)))
    : xAxis.min + (px - plotX) / plotW * (xAxis.max - xAxis.min);

  const yInv = py => yAxis.log
    ? Math.pow(10, Math.log10(yAxis.min) + (1 - (py - plotY) / plotH)
        * (Math.log10(yAxis.max) - Math.log10(yAxis.min)))
    : yAxis.min + (1 - (py - plotY) / plotH) * (yAxis.max - yAxis.min);

  return { plotX, plotY, plotW, plotH, xScale, yScale, xInv, yInv };
}

/**
 * Generate nice tick values for linear or log axes.
 */
function pmNiceTicks(min, max, log, approxCount = 6) { /* ... */ }

/**
 * Draw axes: grid lines, tick labels, axis labels.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} layout - From pmAxisLayout
 * @param {{ label, unit, ticks }} xCfg, yCfg
 */
function pmDrawAxes(ctx, layout, xCfg, yCfg) { /* ... */ }
```

Standard T(x) vs P(y) configuration:
```javascript
const PM_AXES_TP = {
  x: { min: 100, max: 1000, log: false, label: 'Temperature', unit: 'K' },
  y: { min: 1e3, max: 1e7, log: true, label: 'Pressure', unit: 'Pa' }
};
```

---

## S7a-4. Pointer Tracking + Operating Point Marker

```javascript
/**
 * Attach pointer tracking to a performance map canvas.
 * Shows crosshair + value readout on hover.
 */
function pmPointerTrack(canvas, layout, readoutEl, xFmt, yFmt) {
  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Redraw from cached ImageData + crosshair
    // Update readout: "T = 450 K, P = 3.2 bar"
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', () => { /* clear crosshair */ });
}

/**
 * Draw operating point marker (filled circle + crosshair lines).
 * @param {number} xVal, yVal - Data coordinates
 */
function pmDrawMarker(ctx, layout, xVal, yVal, color = '#e74c3c') { /* ... */ }
```

---

## S7a-5. Color Scale Utilities

```javascript
/**
 * Viridis-like palette for heatmaps.
 * Input: t ∈ [0, 1]. Output: [r, g, b] ∈ [0, 255].
 * Uses sqrt compression for better low-end resolution.
 */
function pmColorScale(t) {
  t = Math.sqrt(Math.max(0, Math.min(1, t)));  // sqrt compression
  // 5-stop interpolation approximating viridis
  const stops = [
    [68, 1, 84],     // 0.0 — dark purple
    [59, 82, 139],   // 0.25 — blue
    [33, 145, 140],  // 0.50 — teal
    [94, 201, 98],   // 0.75 — green
    [253, 231, 37]   // 1.0 — yellow
  ];
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx), hi = Math.min(lo + 1, stops.length - 1);
  const f = idx - lo;
  return [
    Math.round(stops[lo][0] + f * (stops[hi][0] - stops[lo][0])),
    Math.round(stops[lo][1] + f * (stops[hi][1] - stops[lo][1])),
    Math.round(stops[lo][2] + f * (stops[hi][2] - stops[lo][2]))
  ];
}

/** 8-color categorical palette for species curves */
const PM_SPECIES_COLORS = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800',
  '#9C27B0', '#00BCD4', '#795548', '#607D8B'
];

function pmSpeciesColor(index) {
  return PM_SPECIES_COLORS[index % PM_SPECIES_COLORS.length];
}
```

---

## S7a-6. Species VP Envelopes (PM-1)

Curve map: T(x) vs Psat(y, log scale). One line per species in
the current stream composition. Tc dots at each curve's terminus.

```javascript
/**
 * Compute VP envelope data for species set.
 * @param {string[]} species - Component IDs
 * @returns {{ species: string, points: [{T, Psat}], Tc, Pc }[]}
 */
PerfMapData.getPhaseEnv = function(species) {
  return species.map(sp => {
    const cd = ComponentRegistry.get(sp);
    if (!cd || !cd.Tc) return null;

    const points = [];
    const Tmin = cd.Tm || 100;
    const Tmax = cd.Tc;
    const nSteps = 50;

    for (let i = 0; i <= nSteps; i++) {
      const T = Tmin + (Tmax - Tmin) * i / nSteps;
      const Psat = thermo.saturationPressure(sp, T);
      if (Psat && Psat > 0) points.push({ T, Psat });
    }

    return { species: sp, points, Tc: cd.Tc, Pc: cd.Pc };
  }).filter(Boolean);
};

/**
 * Render VP envelope on canvas.
 */
function pmDrawVPEnvelope(ctx, layout, envData) {
  envData.forEach((env, idx) => {
    const color = pmSpeciesColor(idx);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    env.points.forEach((pt, i) => {
      const x = layout.xScale(pt.T);
      const y = layout.yScale(pt.Psat);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Tc dot at terminus
    if (env.Tc && env.Pc) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(layout.xScale(env.Tc), layout.yScale(env.Pc), 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}
```

**Inspector hooks:** flash_drum, HEX (hot side), air_cooler, valve.
Each unit's inspector `.map` config returns the species from the
inlet stream.

**Cache:** By composition set (sorted species list as key). Invalidated
when composition changes. Computation < 1 ms per species.

---

## S7a-7. Alarm Rationalization

**Current:** `AlarmSystem._rationalize()` is a skeleton (from S1).

**Implement:** Dedup by alarm `id` — keep highest severity.

```javascript
AlarmSystem._rationalize = function(rawAlarms) {
  const byId = new Map();
  const sevOrder = { OK: 0, INFO: 1, WARNING: 2, ERROR: 3, CRITICAL: 4 };

  for (const alarm of rawAlarms) {
    const existing = byId.get(alarm.id);
    if (!existing || (sevOrder[alarm.severity] || 0) > (sevOrder[existing.severity] || 0)) {
      byId.set(alarm.id, alarm);
    }
  }

  return [...byId.values()];
};
```

~10 lines. Wrap into `AlarmSystem.evaluate()` pipeline:
```javascript
AlarmSystem.evaluate = function(scene) {
  let raw = [];
  for (const [name, sourceFn] of this._sources) {
    raw = raw.concat(sourceFn(scene));
  }
  return this._rationalize(raw);
};
```

Future extensions (cascade suppression, aggregation, shelving,
dead-banding) plug into `_rationalize()` without changing sources
or presentation.

---

# S7b — Dynamic Maps + Reactor Maps + Integration

**Sessions:** 2 (pump/compressor + reactor maps, then overlays + column + inspector hooks).

## S7b-1. Pump Cavitation Map (PM-2)

Curve map: T(x) vs P_bubble(y). Region below curve = safe (subcooled).
Region above = cavitation risk.

```javascript
PerfMapData.getBubbleCurve = function(composition) {
  const points = [];
  const Tmin = 200, Tmax = 600, nSteps = 40;

  for (let i = 0; i <= nSteps; i++) {
    const T = Tmin + (Tmax - Tmin) * i / nSteps;
    let Pbub = 0;
    for (const [sp, x] of Object.entries(composition)) {
      const Psat = thermo.saturationPressure(sp, T);
      if (Psat) Pbub += x * Psat;  // Raoult or PR bubble
    }
    if (Pbub > 0) points.push({ T, P: Pbub });
  }
  return points;
};
```

Rendering: shaded safe region below curve (green tint), danger above
(red tint). Operating point marker at (T_in, P_in).

**Inspector hook:** pump. Shows inlet composition bubble curve.
Default: pure water curve before first solve.

## S7b-2. Compressor Condensation Map (PM-3)

Curve map: T(x) vs P_dew(y). Region above curve = safe (superheated).
Region below = condensation risk.

```javascript
PerfMapData.getDewCurve = function(composition) {
  const points = [];
  const Tmin = 100, Tmax = 500, nSteps = 40;

  for (let i = 0; i <= nSteps; i++) {
    const T = Tmin + (Tmax - Tmin) * i / nSteps;
    let Pdew_inv = 0;
    for (const [sp, y] of Object.entries(composition)) {
      const Psat = thermo.saturationPressure(sp, T);
      if (Psat && Psat > 0) Pdew_inv += y / Psat;
    }
    if (Pdew_inv > 0) points.push({ T, P: 1 / Pdew_inv });
  }
  return points;
};
```

**Inspector hook:** compressor. Default: air (N₂/O₂ mix).

---

## S7b-3. Reactor Feasibility Maps (PM-4, PM-5)

Field map: T(x) vs P(y) → conversion % (color). Two variants:
isothermal (PM-4) and adiabatic (PM-5).

```javascript
/**
 * Compute reactor feasibility grid.
 * @param {string} reactionId
 * @param {Object} options - { nT: 25, nP: 20, T_range, P_range, mode }
 * @returns {{ grid: number[][], T_vals: number[], P_vals: number[], reactionId }}
 */
PerfMapData.computeReactorGrid = function(reactionId, options = {}) {
  const rxn = ReactionRegistry.get(reactionId);
  if (!rxn) return null;

  const nT = options.nT || 25;
  const nP = options.nP || 20;
  const Tmin = options.T_range?.[0] || rxn.Tmin_K || 300;
  const Tmax = options.T_range?.[1] || rxn.Tmax_K || 1000;
  const Pmin = options.P_range?.[0] || rxn.Pmin_Pa || 1e4;
  const Pmax = options.P_range?.[1] || rxn.Pmax_Pa || 1e7;
  const mode = options.mode || 'isothermal';

  const T_vals = Array.from({ length: nT }, (_, i) =>
    Tmin + (Tmax - Tmin) * i / (nT - 1));
  const P_vals = Array.from({ length: nP }, (_, i) =>
    Math.pow(10, Math.log10(Pmin) + (Math.log10(Pmax) - Math.log10(Pmin)) * i / (nP - 1)));

  // Build stoichiometric feed (1 mol/s of each reactant)
  const feed = {};
  for (const [sp, nu] of Object.entries(rxn.stoich)) {
    if (nu < 0) feed[sp] = Math.abs(nu);  // stoichiometric ratio
  }

  const grid = [];
  for (let j = 0; j < nP; j++) {
    const row = [];
    for (let i = 0; i < nT; i++) {
      const T = T_vals[i], P = P_vals[j];
      let conversion;

      if (mode === 'isothermal') {
        // Direct equilibrium K evaluation at T, P
        const lnK = computeLnKeq(rxn, T);
        conversion = equilibriumConversion(rxn, feed, T, P, lnK);
      } else {
        // Adiabatic: iterate T_out from energy balance
        conversion = adiabaticConversion(rxn, feed, T, P);
      }

      row.push(Math.max(0, Math.min(100, conversion * 100)));
    }
    grid.push(row);
  }

  return { grid, T_vals, P_vals, reactionId, mode };
};
```

**Cache:** By `reactionId + composition hash + mode`. ~35 ms per
reaction. Warm-start: reuse previous grid, recompute only changed
cells on parameter change.

**Rendering:**
```javascript
function pmDrawHeatmap(ctx, layout, gridData) {
  const { grid, T_vals, P_vals } = gridData;
  const nT = T_vals.length, nP = P_vals.length;
  const cellW = layout.plotW / nT;
  const cellH = layout.plotH / nP;

  for (let j = 0; j < nP; j++) {
    for (let i = 0; i < nT; i++) {
      const [r, g, b] = pmColorScale(grid[j][i] / 100);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const x = layout.xScale(T_vals[i]) - cellW / 2;
      const y = layout.yScale(P_vals[j]) - cellH / 2;
      ctx.fillRect(x, y, cellW + 1, cellH + 1);
    }
  }
}

function pmDrawContours(ctx, layout, gridData, levels = [10, 25, 50, 75, 90]) {
  // Marching squares on each level
  // Label each contour with percentage
}
```

**Inspector hooks:** reactor_equilibrium (both isothermal and adiabatic
mode maps shown), reactor_electrochemical (conversion vs power curve
instead of T×P field).

---

## S7b-4. Limit Region Overlays (PM-6)

Semi-transparent red/amber bands on any map with matching axes.

```javascript
/**
 * Draw limit region overlays from equipment limits.
 * @param {Object} limits - From getEffectiveLimits()
 * @param {string} xParam - Which limit param maps to X axis ('T', 'P', etc)
 * @param {string} yParam - Which limit param maps to Y axis
 */
function pmDrawLimitOverlays(ctx, layout, limits, xParam, yParam) {
  const drawBand = (axis, lo, hi, color) => {
    ctx.fillStyle = color;
    if (axis === 'x') {
      const x1 = layout.xScale(lo), x2 = layout.xScale(hi);
      ctx.fillRect(x1, layout.plotY, x2 - x1, layout.plotH);
    } else {
      const y1 = layout.yScale(hi), y2 = layout.yScale(lo);
      ctx.fillRect(layout.plotX, y1, layout.plotW, y2 - y1);
    }
  };

  const CRIT_COLOR = 'rgba(220, 50, 50, 0.15)';
  const WARN_COLOR = 'rgba(255, 160, 0, 0.10)';

  // X axis limits
  if (limits[xParam]) {
    const lx = limits[xParam];
    if (lx.LL != null) drawBand('x', -Infinity, lx.LL, CRIT_COLOR);
    if (lx.L != null && lx.LL != null) drawBand('x', lx.LL, lx.L, WARN_COLOR);
    if (lx.HH != null) drawBand('x', lx.HH, Infinity, CRIT_COLOR);
    if (lx.H != null && lx.HH != null) drawBand('x', lx.H, lx.HH, WARN_COLOR);
  }
  // Y axis limits (same pattern)
  if (limits[yParam]) {
    const ly = limits[yParam];
    if (ly.LL != null) drawBand('y', -Infinity, ly.LL, CRIT_COLOR);
    if (ly.HH != null) drawBand('y', ly.HH, Infinity, CRIT_COLOR);
  }
}
```

Overlaid on VP envelopes (T/P axes), pump/compressor maps (T/P),
and reactor feasibility maps (T/P). Data from `getEffectiveLimits()`
(S1).

---

## S7b-5. Column Operating Map

Gilliland curve: X vs Y. Shows minimum stages, minimum reflux,
actual operating point.

```javascript
function pmDrawGillilandMap(ctx, layout, columnData) {
  const { N_min, R_min, R, N_actual, N_stages } = columnData;

  // Gilliland correlation curve
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let X = 0.01; X < 0.99; X += 0.01) {
    const Y = 1 - Math.exp(
      ((1 + 54.4 * X) / (11 + 117.2 * X)) * ((X - 1) / Math.sqrt(X))
    );
    const px = layout.xScale(X);
    const py = layout.yScale(Y);
    X < 0.02 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Operating point
  if (R > R_min) {
    const X_op = (R - R_min) / (R + 1);
    const Y_op = 1 - Math.exp(
      ((1 + 54.4 * X_op) / (11 + 117.2 * X_op)) * ((X_op - 1) / Math.sqrt(X_op))
    );
    pmDrawMarker(ctx, layout, X_op, Y_op, '#e74c3c');
  }

  // Labels
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.fillText(`N_min = ${N_min?.toFixed(1)}`, layout.plotX + 5, layout.plotY + 15);
  ctx.fillText(`R_min = ${R_min?.toFixed(2)}`, layout.plotX + 5, layout.plotY + 28);
}
```

Axes: X = (R−R_min)/(R+1) [0..1], Y = (N−N_min)/(N+1) [0..1].
**Inspector hook:** distillation_column only.

---

## S7b-6. Inspector Integration

Each unit type gains a `map` config in its inspector definition:

```javascript
// Pattern for all map-equipped units:
UnitInspector.flash_drum.map = function(u, ud) {
  const species = ud?.inlet ? Object.keys(ud.inlet.n || {}) : [];
  return {
    type: 'vp_envelope',
    species,
    operatingPoint: ud?.last ? { T: ud.last.T_C + 273.15, P: ud.last.P_bar * 1e5 } : null,
    limits: getEffectiveLimits(UnitRegistry.get('flash_drum'), u)
  };
};
```

**Map assignments by unit type:**

| Unit | Map type | Notes |
|------|----------|-------|
| flash_drum | VP envelope (PM-1) | Species from inlet |
| hex (hot) | VP envelope (PM-1) | Hot side species |
| hex (cold) | VP envelope (PM-1) | Cold side species |
| air_cooler | VP envelope (PM-1) | Process side species |
| valve | VP envelope (PM-1) | Species from inlet |
| pump | Bubble P curve (PM-2) | Inlet liquid composition |
| compressor | Dew P curve (PM-3) | Inlet vapor composition |
| reactor_equilibrium | Reactor T×P (PM-4/5) | Current reaction |
| reactor_electrochemical | Conversion vs power | Linear curve |
| distillation_column | Gilliland curve | Current FUG data |

**Rendering in inspector:**
```javascript
// In inspector rendering loop, after params/kpis/power sections:
if (inspectorDef.map) {
  const mapConfig = inspectorDef.map(unit, unitData);
  if (mapConfig) {
    const container = createEl('div', 'pm-container');
    detailPanel.appendChild(container);
    requestAnimationFrame(() => pmRender(container, mapConfig));
  }
}
```

**Click-to-expand:** Clicking the ⛶ icon opens a modal with the map
rendered at 80vw for detailed inspection. Same data, larger canvas.

---

## Tests (~5)

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | VP envelope: H₂O curve passes 373K/1atm | getPhaseEnv(['H2O']) | Psat(373.15K) ≈ 101325 ±5% |
| 2 | Reactor map: Haber conversion increases with P | computeReactorGrid('R_HABER', {mode:'isothermal'}) | grid[high P][mid T] > grid[low P][mid T] (Le Chatelier) |
| 3 | Limit overlay: LL/HH regions rendered | Limits with T_LL=73, T_HH=523 → overlay bands present | bands.length ≥ 2 |
| 4 | Column map: operating point inside feasible | Gilliland X,Y from FUG data | 0 < X_op < 1, 0 < Y_op < 1 |
| 5 | Alarm rationalization: dedup | Two alarms same id, different severity | 1 alarm, higher severity wins |

**Gate:** All previous (442) + 5 new pass → 447 cumulative.

---

## Implementation Checklist

```
S7a session 1 (rendering + VP):
  [ ] pm-* CSS classes in style block
  [ ] pmSetupCanvas() with HiDPI
  [ ] pmAxisLayout() with lin/log scale
  [ ] pmNiceTicks() for tick generation
  [ ] pmDrawAxes() with grid, ticks, labels
  [ ] pmPointerTrack() with crosshair + readout
  [ ] pmDrawMarker() for operating point
  [ ] pmColorScale() viridis-like with sqrt compression
  [ ] pmSpeciesColor() 8-color categorical
  [ ] PM_AXES_TP standard constant
  [ ] PerfMapData.getPhaseEnv() compute + cache
  [ ] pmDrawVPEnvelope() (lines + Tc dots)
  [ ] Test 1: H₂O VP at 373K

S7a session 2 (rationalization + bubble/dew):
  [ ] AlarmSystem._rationalize() dedup implementation
  [ ] AlarmSystem.evaluate() pipeline wiring
  [ ] PerfMapData.getBubbleCurve()
  [ ] PerfMapData.getDewCurve()
  [ ] Default water/air curves
  [ ] Test 5: alarm dedup

S7b session 1 (reactor maps):
  [ ] PerfMapData.computeReactorGrid() with warm-start
  [ ] equilibriumConversion() per grid cell
  [ ] adiabaticConversion() per grid cell (energy balance iteration)
  [ ] pmDrawHeatmap() (color fill, sqrt compression)
  [ ] pmDrawContours() (marching squares + labels)
  [ ] Composition hash cache
  [ ] Test 2: Haber conversion vs P

S7b session 2 (overlays + column + hooks):
  [ ] pmDrawLimitOverlays() (CRIT/WARN bands)
  [ ] pmDrawGillilandMap() (X vs Y curve + operating point)
  [ ] Inspector .map config on 10 unit types
  [ ] Inspector rendering: pm-container + pmRender()
  [ ] pmOpenExpanded() modal
  [ ] Tests 3, 4
  [ ] Full regression

Total S7: 5 new tests → 447 cumulative
```

---

## What S7 Enables Downstream

| Consumer | What it uses from S7 |
|----------|---------------------|
| S8 (Game) | Visual feedback during missions: VP envelopes help player understand phase behavior, reactor maps show optimal operating region, limit overlays show equipment boundaries |
| Future | Chart infrastructure (pmSetupCanvas, pmAxisLayout, pmColorScale) reusable for time-series, Sankey, bar/pie charts |
| Future | Alarm rationalization skeleton ready for cascade suppression, aggregation, shelving, dead-banding |
