# Process Grid v1.8.0 — Code Review & Test Failure Diagnosis

---

## PART 1: Test 11 & 12 Failure Diagnosis

### Root Cause Summary

There are **three independent bugs** that conspire to cause the failures. Two are in the thermodynamic engine, and one is in the test harness.

---

### Bug A: Tests call `phFlash` with the wrong calling convention

**Location:** Test 11 (line 8864) and Test 12 (line 9053)

The function signature is:

```javascript
phFlash(stream, H_target_Jps)   // two arguments
```

The solver calls it correctly:

```javascript
result = thermo.phFlash(stream, stream.H_target_Jps);  // line 4113
```

But both tests pass `H_target_Jps` as a *property on the stream object* instead of as the second argument:

```javascript
const result_low = thermo.phFlash({
  P: P_test,
  n: n_test,
  H_target_Jps: H_target_low   // ← This is on the stream, not the 2nd arg
});
// Second parameter H_target_Jps is `undefined`
```

**Consequence:** Inside `phFlash`, `H_target_Jps` is `undefined`. The line `h_target = H_target_Jps / nTot` yields `NaN`. All subsequent comparisons against `NaN` are false, so the code silently falls through to incorrect branches.

**Suggested fix (pick one):**

- *Option A (fix tests):* Change test calls to `thermo.phFlash({ P, n }, H_target)`.
- *Option B (fix API — recommended):* Have `phFlash` also read from the stream object when the second arg is missing: `H_target_Jps = H_target_Jps ?? stream.H_target_Jps`. This makes the function accept both calling styles and eliminates the discrepancy between the solver calling convention and direct use. This is the more defensive choice and aligns with how every unit operation already constructs the stream with `H_target_Jps` as a property.

---

### Bug B: `_phFlash_SingleComponent` was never hardened in v1.8.0

**Location:** Lines 2089–2163

The v1.8.0 robustness work (bracketing re-check, residual-based convergence, metadata completeness) was applied **only to `_phFlash_General`**. The single-component path was untouched.

Both tests use single-component feeds (N₂ and He) with no explicit `phaseConstraint`, so `phaseConstraint` defaults to `'VL'`. This satisfies the routing condition `isSingleComponent && phaseConstraint === 'VL'`, sending both tests through `_phFlash_SingleComponent`.

That function:

1. **Always returns `converged: true`** regardless of success.
2. **Never returns** `bracketed`, `residual_Jps`, or `warning`.
3. Delegates to `_solveTemperatureForEnthalpy` which has no out-of-range detection.

Since the tests check for `converged === false`, `warning` present, `residual_Jps` present, and `T` in a reasonable range — all of which depend on the hardened metadata — they fail.

**Suggested fix:** Apply the same truthfulness contract to `_phFlash_SingleComponent`. Specifically:

- `_solveTemperatureForEnthalpy` should compute and return a residual, report `converged` based on that residual, and include the same metadata fields.
- Alternatively, for the extreme-target case, detect that h_target is outside [hf, hg] bounds AND outside the Tmin/Tmax solve range for the subcooled/superheated branches, and return `converged: false` with an appropriate warning.

---

### Bug C: `_findSaturationTemperature` is broken for cryogenic fluids

**Location:** Lines 2377–2418

The function hardcodes `Tmin = 200` K, but N₂ (Tc = 126.2 K), He (Tc = 5.2 K), O₂ (Tc = 154.6 K), H₂ (Tc = 33.2 K), and Ar (Tc = 150.9 K) all have critical temperatures below 200 K.

This creates an **inverted bracket** where `Tmin > Tmax`. The bisection computes `Tmid = (200 + Tc) / 2` and then tests `Tmax - Tmin < 0.01`. Since the bracket is inverted (e.g., 163.1 − 200 = −36.9), this is always `< 0.01`, so **the function returns immediately** with a meaningless midpoint:

- N₂: returns (200 + 126.2) / 2 = **163.1 K** → after one Psat eval at that T, exits with ~181.6 K (matching the test output exactly)
- He: returns (200 + 5.19) / 2 = **102.6 K** → exits with ~151.3 K (matching the test output exactly)

These are physically meaningless "saturation temperatures" (the real Tsat for N₂ at 1 atm is ~77 K; for He it's ~4.2 K).

**Suggested fix:**

- Set `Tmin` to something appropriate, e.g., `Math.max(50, compData.Tm || 10)` or `compData.Tb * 0.5`.
- Add an explicit guard: `if (Tmin >= Tmax) return null` — this causes _phFlash_SingleComponent to fall back to `_phFlash_General`, which actually handles cryogenic gases correctly via its wider Tmin=100 bracket.
- Change the early-exit check to `if (Math.abs(Tmax - Tmin) < 0.01)` to guard against inverted brackets.

---

### How the three bugs produce the observed output

**Test 11 (N₂, unachievable target):**

1. Bug A: H_target_Jps is undefined → h_target is NaN.
2. Routes to `_phFlash_SingleComponent` (single component, VL).
3. Bug C: `_findSaturationTemperature` returns ~181.6 K (meaningless).
4. NaN comparisons with hf/hg all fail → falls into two-phase branch.
5. Bug B: Returns `{T_K: 181.6, converged: true}` with no `bracketed`, `residual_Jps`, or `warning`.
6. Test checks fail: `converged` is true (expected false), `warning` is missing, `residual` is NaN.

**Test 12 (He, near-zero denominator):**

1. Bug A: H_target_Jps is undefined → h_target is NaN.
2. Routes to `_phFlash_SingleComponent`.
3. Bug C: `_findSaturationTemperature` returns ~151.3 K (meaningless).
4. NaN falls into two-phase branch.
5. Bug B: Returns `{T_K: 151.3, converged: true}` with no metadata.
6. Test checks fail: T = 151.3 K is outside [200, 400] K, metadata incomplete.

---

### Fix implementation order (recommendation)

1. **Fix Bug A first** (phFlash calling convention) — this is the most fundamental issue and blocks everything else.
2. **Fix Bug C** (_findSaturationTemperature) — this restores correct Tsat for cryogenic components.
3. **Fix Bug B** (_phFlash_SingleComponent hardening) — this ensures the robustness metadata is present on all code paths.
4. Re-run tests to confirm all 50 checks pass.

---

## PART 2: Comprehensive Code Review

### 0. Bugs, Silent Bugs, and Potential Corruption States

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 0.1 | **CRITICAL** | `phFlash` (L2043) | Calling convention ambiguity: H_target_Jps is a function parameter but the stream object also carries it. Solver uses `phFlash(stream, stream.H_target_Jps)` but any direct caller (including tests) can easily pass it on the stream only. The function should read from either source. |
| 0.2 | **CRITICAL** | `_findSaturationTemperature` (L2386) | `Tmin = 200` hardcoded — broken for all cryogenic fluids. Inverted bracket goes undetected due to signed comparison `Tmax - Tmin < 0.01`. |
| 0.3 | **HIGH** | `_phFlash_SingleComponent` (L2089–2163) | Never returns `converged: false`. No residual calculation. A completely bogus result is reported as converged. |
| 0.4 | **HIGH** | `_solveTemperatureForEnthalpy` (L2424–2453) | No guard against inverted Tmin/Tmax. No guard against out-of-range h_target (if h_target is below h(Tmin) or above h(Tmax), bisection converges to an endpoint and returns it as if successful). No residual or convergence metadata returned. |
| 0.5 | **MEDIUM** | `density()` (L2880–2888) | Hardcoded liquid density lookup map inside ThermoAdapter. Missing He, CO₂. New components require editing this function — violates the ComponentRegistry principle. |
| 0.6 | **MEDIUM** | `tpFlash` single-component (L1965–1976) | Uses a hardcoded K-value band `[0.95, 1.05]` for VL detection. This is an arbitrary threshold that could misclassify near-critical states. |
| 0.7 | **LOW** | `<title>` (L74) | Says "v1.0.3" instead of "v1.8.0". |
| 0.8 | **LOW** | `tpFlash` JSDoc (L1898–1909) | Duplicate JSDoc block (two `/** ... */` comments for the same function). |
| 0.9 | **LOW** | `saturationPressure` JSDoc (L2455–2462) | Legacy stub comment mixed with actual function documentation. "Pressure-Enthalpy flash calculation (LEGACY STUB)" precedes the saturationPressure function, not a PH flash. |
| 0.10 | **LOW** | Solver convergence (L4396) | `const ok = !changed || iter < MAX_ITER` — if `changed` is true and `iter === MAX_ITER`, `ok` is `false || false = false`, which is correct. But if `changed` is false and `iter === MAX_ITER`, `ok = true || false = true`. This is also correct (converged at the limit). No bug, but the logic could be clearer: `ok = !changed` (converged) vs `iter >= MAX_ITER` (timeout). |
| 0.11 | **MEDIUM** | `hMolar` liquid Cp polynomial (L2613–2618) | The polynomial integration uses `T⁵/5` for the E coefficient but liquid Cp correlations typically have 3 terms. The exponent `T * T * T * T * T / 5` is `T⁵/5`, matching `E*T⁴` integration — correct math. But the E coefficient name is never documented for liquid Cp. Minor confusion risk. |
| 0.12 | **MEDIUM** | `computeStreamEnthalpy` validation (L1805) | Warns if `Hdot ≈ 0` at non-reference T, but this is a false alarm for streams where liquid Cp × (T − Tref) happens to nearly equal the vapor offset magnitude. Consider removing or making it debug-only. |

---

### 1. General Coding Best Practices

**Strengths:**

- Clean `"use strict"` mode. Consistent use of `const`/`let`.
- Good use of `Map` for scene entities.
- Reasonable function decomposition for thermodynamic calculations.
- Warning deduplication via `_warnedRanges` Set is a nice touch.

**Issues:**

| # | Issue | Detail |
|---|-------|--------|
| 1.1 | **Magic numbers scattered throughout** | `0.9999`/`1.0001` factors in single-component PH flash (L2106, 2124), `1e-12` tolerance in multiple places, `0.01` bracket-too-narrow thresholds, `100`/`3000` for T bounds. These should be named constants at the top of ThermoAdapter. |
| 1.2 | **Inconsistent naming: `ports` parameter overloaded** | In `tick(u, ports, par)`, `ports` is an object where `tick` reads input ports AND writes output ports. The variable serves dual duty as both input bus and output bus. While it works, the name is misleading. A comment at the solver level documenting this convention would help. |
| 1.3 | **`inPorts` naming in solver is misleading** | At L4105: `const stream = inPorts[p.portId]` — but this reads an OUT port that was written by tick. The solver uses `inPorts` for both inputs and outputs, then stores them in `ud.ports`. Rename to `portBus` or `portsIO`. |
| 1.4 | **No TypeScript / JSDoc type annotations on key interfaces** | Stream objects, flash results, and unit parameters are all plain objects with implicit schemas. A `@typedef` block at the top would help. |
| 1.5 | **Console.warn spam potential in production** | Many `console.warn` calls fire during normal operation (e.g., extrapolation warnings). Consider a log-level system or at minimum a way to suppress during solver iterations. |
| 1.6 | **`last` property on units is ambiguous** | `u.last` (unit calculation results) vs `ud.last` (runtime data). Both are used, and the solver resets both separately (L4075–4077). This dual storage increases the risk of stale data leaking through. Consider consolidating into one location. |

---

### 2. Strict Adherence to Architectural Principles

**Architecture principle compliance scorecard:**

| Principle | Status | Notes |
|-----------|--------|-------|
| Single thermo entrypoint (ThermoAdapter) | ✅ Mostly | All units call `thermo.*`. One exception below. |
| ComponentRegistry as single source of truth | ⚠️ Violated | `density()` has hardcoded lookup table (issue 0.5). |
| Internal units (K, Pa, mol/s, J/mol, J/s) | ✅ Good | Consistently applied. Display conversions at boundaries. |
| Units never call EOS/flash directly | ✅ Good | Units set `H_target_Jps` on streams; solver calls `phFlash`. |
| ModelRegistry as extensible kernel system | ⚠️ Partial | Legacy model categories removed, but the flash/thermo logic is hardcoded in ThermoAdapter rather than being a swappable model. The PR-EOS upgrade will need refactoring here. |

**Specific issues:**

| # | Issue | Detail |
|---|-------|--------|
| 2.1 | **`density()` hardcoded map violates ComponentRegistry principle** | Liquid densities for H₂O, O₂, H₂, N₂, Ar, CH₄ are hardcoded inline. He and CO₂ are missing. Should read from `ComponentRegistry.get(comp).densityLiq` (the slot exists in the schema but is never populated). |
| 2.2 | **ThermoAdapter is the single thermo entrypoint, but it's also monolithic** | The class currently handles ideal-gas Cp, Antoine Psat, flash, enthalpy, density — everything. When PR-EOS is added, the class will need internal strategy/dispatch. Consider now whether the ModelRegistry should provide pluggable EOS objects that ThermoAdapter delegates to. |
| 2.3 | **`_vaporOffsetCache` lives on the ThermoAdapter instance** | But `thermo` is a module-level singleton, so this works. However, if ComponentRegistry data is ever updated at runtime (e.g., user adds a component), the cache is never invalidated. Add a `clearCaches()` method. |
| 2.4 | **No formal "flash result" schema** | `_phFlash_SingleComponent` returns a different shape than `_phFlash_General` (missing `bracketed`, `residual_Jps`, `Tmin_K`, `Tmax_K`, `warning`). The consumer (solver, tests) must handle both. Define a canonical `FlashResult` type and ensure all code paths conform. |

---

### 3. Thermodynamic Rigor — Mass and Energy Balance

**Strengths:**

- Enthalpy reference state is well-defined (liquid at 298.15 K) with latent heat offset — this is correct practice.
- Vapor enthalpy offset `dHref_vap = Hv - (hV_sens_at_Tb - hL_at_Tb)` correctly ensures `hV(Tb) - hL(Tb) = Hv`.
- Mass balance is verified in the solver's fifth pass.
- Energy balance is checked (informational) in the solver.

**Issues:**

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| 3.1 | **HIGH** | Cp_ig correlation range enforcement | The Cp polynomial is evaluated by extrapolation outside its valid range (100–2000 K for N₂). Polynomials extrapolate *catastrophically* — a T⁴ term at 3000 K can give nonsensical Cp values. At minimum, clamp T to [Tmin, Tmax] for the polynomial evaluation while still allowing hMolar to return enthalpy at the clamped T. Currently only a warning is emitted. |
| 3.2 | **HIGH** | Liquid Cp is a constant | Fine for small T ranges near Tref, but for subcooled liquids far from 298 K (e.g., liquid N₂ at 77 K), using `cpLiq * (T - 298.15)` gives a hugely negative enthalpy that may be physically unreasonable. The liquid sensible heat path covers T ranges of hundreds of kelvin with a constant Cp. For now, document this limitation prominently. |
| 3.3 | **MEDIUM** | No pressure correction on vapor enthalpy | `hMolar` for vapor uses ideal-gas integration only. For high pressures or near-critical conditions, departure functions are needed. This is acknowledged (PR-EOS is WIP), but the current code should at least flag when T is near Tc or P is near Pc. |
| 3.4 | **MEDIUM** | Heat exchanger uses constant-Cp energy balance | The `hex` unit computes Q = Cp × ΔT using `streamCp` evaluated at the inlet T. For large temperature changes or phase-changing streams, this is inaccurate. The heater correctly uses PH flash via `H_target_Jps`, but the two-stream HX does not — it sets `T` directly on the outlet stream. This means the HX bypasses the PH flash path and doesn't properly account for latent heat. |
| 3.5 | **MEDIUM** | Compressor uses constant gamma | Gamma is computed at inlet T only. For large compression ratios, gamma varies significantly over the temperature rise. A polytropic integration (multiple small isentropic steps) would be more accurate. |
| 3.6 | **LOW** | Antoine equation validity | Antoine is used far outside its valid range for cryogenic fluids during PH flash bracket widening (T=100 K for water, T=3000 K for N₂). The extrapolated Psat values are used in tpFlash inside the Hcalc lambda, potentially producing wrong phase determinations at extreme temperatures. |
| 3.7 | **LOW** | Missing enthalpy of mixing | For ideal solutions this is zero, which is correct. But document this assumption explicitly so that when activity-coefficient models are added, the enthalpy calculation is updated. |

---

### 4. Process Simulator Fundamentals and Best Practices

**Strengths:**

- Successive substitution solver with convergence detection.
- Mass balance verification pass.
- Energy balance verification pass (informational).
- Clear separation: units specify thermodynamic *targets*, solver resolves *state*.
- Error severity classification (MINOR, MAJOR, CATASTROPHIC) is excellent practice.

**Issues:**

| # | Issue | Detail |
|---|-------|--------|
| 4.1 | **No topological ordering** | The solver iterates over `scene.units` in insertion order. For sequential flowsheets, this works. But for recycles or complex networks, proper topological ordering (or at least dependency-aware sequencing) would reduce iterations dramatically. The architecture overview mentions "topological ordering" but the code does simple iteration. |
| 4.2 | **Convergence check uses `JSON.stringify` diff** | This is expensive and can produce false negatives for insignificant floating-point differences. A norm-based convergence check (e.g., max relative change in stream T, P, n across all ports) would be more robust and much cheaper. |
| 4.3 | **No tear stream / recycle handling** | The solver has no concept of tear streams or Wegstein/DIIS acceleration. This will matter when recycle loops are introduced. |
| 4.4 | **Solver does flash on output ports after tick** | At L4103, the solver iterates over OUT ports and flashes the stream. But it reads the stream from `inPorts[p.portId]` — which is the *output* stream written by tick into the same `inPorts` object. This works but the naming is extremely confusing. A comment clarifying this data flow would prevent future mistakes. |
| 4.5 | **No unit initialization validation** | When a unit is placed, `params` defaults to `{}`. If the user doesn't configure all required parameters (e.g., species, T, P for a source), the tick function receives undefined values and silently produces garbage. A `validate(params)` method per unit definition would catch configuration errors before solving. |
| 4.6 | **No stream specification degrees-of-freedom check** | A stream with both T and H_target_Jps specified is over-determined. A stream with neither is under-determined. No validation catches these cases. |

---

### 5. Data Management and Import/Export

**Strengths:**

- Clean JSON export with `version` field for schema evolution.
- Defensive import with `??` defaults for missing fields.
- ID counter rebuild on import prevents collisions.
- Model state included in export.

**Issues:**

| # | Issue | Detail |
|---|-------|--------|
| 5.1 | **No schema validation on import** | `importJSON` calls `JSON.parse` and trusts the result. Malformed data (wrong types, missing required fields, invalid defIds) will cause silent failures later during solving. Add a validation pass after parse. |
| 5.2 | **No version migration** | The `version: 7` field exists but no migration logic handles older versions. If the schema changes, old exports will break silently. |
| 5.3 | **Export goes to clipboard only** | No file download option. For large flowsheets, clipboard may fail silently (some browsers have size limits). Add a `Blob` + download link fallback. |
| 5.4 | **Import via `prompt()` is limited** | The `prompt()` dialog is single-line in many browsers and unusable for large JSON. A file picker (`<input type="file">`) would be far more practical. |
| 5.5 | **No undo/redo** | Scene modifications (add/delete unit, add/delete connection, parameter changes) are irreversible. Even a simple "last 10 states" stack would help. |
| 5.6 | **Runtime data not exported** | Calculation results (stream states, unit diagnostics) are lost on export/import. For result sharing, consider an option to include runtime state. |
| 5.7 | **Component library not user-extensible at runtime** | Components are hardcoded. Adding a component requires editing source. A "custom component" import (JSON with properties) would be very valuable. |

---

### 6. CSS & UI Styling

**Strengths:**

- Consistent dark theme with good color palette (`#0f1115` background, `#e7e7e7` text).
- Use of CSS custom properties via `color-scheme: dark`.
- Consistent border radius (`12px`/`14px`), spacing, and font sizing.
- Good use of `backdrop-filter: blur()` for panel depth.
- Status indicator animations are smooth and professional.
- Stream-type color coding is clear and consistent.

**Issues:**

| # | Issue | Detail |
|---|-------|--------|
| 6.1 | **No CSS custom properties for the color palette** | Colors like `#0b0e14`, `#2a2f3a`, `#1c222e` are used dozens of times as literals. A `:root` variables block (`--bg-primary`, `--border`, `--surface`, etc.) would make theming trivial and reduce duplication. |
| 6.2 | **`border-radius` inconsistency** | Buttons use `12px`, cards use `14px`, modals use `16px`, pills use `999px`. This isn't wrong, but documenting the scale (e.g., "sm: 10px, md: 14px, lg: 16px, pill: 999px") would improve consistency across future additions. |
| 6.3 | **No responsive design** | The `grid-template-columns: 1fr 360px` is a fixed right panel. On small screens, the right panel will squeeze the canvas. A `@media` query to collapse the panel on narrow viewports would help. |
| 6.4 | **`overflow: hidden` on body** | This prevents any scroll on the page. Intentional for the app layout, but combined with no responsive design, content can become unreachable on small screens. |
| 6.5 | **Inline styles on HTML elements** | Several elements use `style="..."` attributes (e.g., the Add Unit button's red background at L709, the status indicator's `display:none` at L712). Move these to CSS classes for consistency. |
| 6.6 | **No focus styles beyond browser defaults** | Keyboard navigation and accessibility would benefit from visible focus indicators on interactive elements. |
| 6.7 | **Commented-out CSS section header** | Line 327 has `/* ===== MODELS DRAWER ===== */` immediately followed by `/* ===== MODALS ===== */`. The "MODELS DRAWER" section is empty — either remove the comment or note that it was replaced by the modal approach. |

---

### 7. Testing System Extensibility and Architecture

**Strengths:**

- Well-structured test suite with clear purpose statements.
- `checkTolerance()` helper with tolerance-based validation.
- Tabular result printing is excellent for diagnostics.
- Scene save/restore pattern prevents test pollution.
- `debugLog` toggle for verbose/quiet modes.
- `recordTestResult` and `recordTestError` provide a clean summary.

**Issues:**

| # | Issue | Detail |
|---|-------|--------|
| 7.1 | **Tests are monolithic** | All 12 tests live in a single `runPHFlashTests()` function spanning ~2000 lines. Each test is a `try/catch` block with massive code duplication for result tracking. Extract each test into its own function: `function test11_phFlashUnachievable(thermo, helpers) { ... }`. |
| 7.2 | **No test isolation** | Tests share the `thermo` singleton and `scene` global. If Test 5 corrupts `thermo._warnedRanges`, Test 6 may behave differently. Each test should either reset adapter state or create a fresh ThermoAdapter. |
| 7.3 | **Duplicated boilerplate per test** | Every test has identical patterns: declare `testNPassed`, `testNFailed`, `results` arrays; call `passCount++`/`failCount++`; push to results; call `printResultsTable`; call `recordTestResult`. This should be a test harness: `runTest("name", (assert) => { assert.equal(...); })`. |
| 7.4 | **Global `passCount`/`failCount` mutated inside helpers** | `checkTolerance()` directly increments `passCount`/`failCount` AND pushes to the passed/failed arrays. This dual bookkeeping is error-prone. The helper should only return a result; the caller should update counters. |
| 7.5 | **No assertion for "approximately equal"** | Tests manually compute `Math.abs(a - b) < tol` or use `checkTolerance`. A proper `assertClose(actual, expected, relTol, absTol, name)` that handles both relative and absolute tolerance would be cleaner. |
| 7.6 | **Test 11 reference values are fragile** | `H_min_achievable = thermo.hMolar('N2', 100, P_test, 'V') * 1.0` computes the reference at test time. If the Cp correlation changes, the reference changes too. This is actually correct (tests should be self-consistent), but document this explicitly — these are not independently verified reference values. |
| 7.7 | **No mechanism to run individual tests** | Can only run all 12 tests via `runPHFlashTests()`. A `runTest(n)` parameter or UI selector would speed up debugging. |
| 7.8 | **Tests mix unit-level and integration-level** | Tests 1–5 build complete flowsheets (source → unit → sink) and run the solver. Tests 6–12 call ThermoAdapter directly. These are different testing levels and should be clearly separated (e.g., "Integration Tests" and "Unit Tests" sections). |

---

## Summary of Recommendations (Prioritized)

### Must Fix (blocks test correctness)

1. **Fix phFlash calling convention** — make it accept H_target_Jps from either the second argument or the stream object.
2. **Fix `_findSaturationTemperature`** — guard against inverted brackets, lower Tmin for cryogenic fluids.
3. **Harden `_phFlash_SingleComponent`** — add convergence metadata (residual, bracketed, warning) and truthful `converged` flag.
4. **Fix `<title>` version string** — trivial, v1.0.3 → v1.8.0.

### Should Fix (correctness and architecture)

5. **Move liquid densities to ComponentRegistry** — populate `densityLiq` field, remove hardcoded map from `density()`.
6. **Define canonical FlashResult type** — all phFlash code paths must return identical shape.
7. **Add Cp polynomial clamping** — extrapolation beyond valid range should clamp T for the polynomial evaluation.
8. **Fix heat exchanger (hex) to use PH flash** — currently bypasses enthalpy-based phase determination.

### Should Improve (engineering quality)

9. **Extract magic numbers to named constants.**
10. **Add schema validation to importJSON.**
11. **Add file-based import/export** (download + file picker).
12. **Refactor test suite** — extract tests into functions, add harness with assertion helpers.
13. **Add CSS custom properties for color palette.**
14. **Invalidate `_vaporOffsetCache` when ComponentRegistry changes.**

---

*Review based on process_grid_v1_8_0.html (9200 lines) and v1_8_0_PH_FLASH_ROBUSTNESS.md patch notes.*
