# Kinetic Equilibrium Reactor — Design & Implementation Plan

**Status**: APPROVED — single source of truth for implementation  
**Target**: processThis.html v8.9.3 → v8.9.8  
**Scope**: Extend existing `reactor_equilibrium` with automatic kinetics-based conversion

---

## 0. Goals

- Automatically compute approach-to-equilibrium (alpha) from kinetics + residence time, replacing the manual alpha slider as the default behavior.
- Support **Reversible Power Law** as the first (and initially only) kinetic model.
- Make kinetics data **mandatory** for all reactions in the registry.
- Implement PFR (plug flow reactor) integration for extent computation.
- Provide a user-facing "Kinetics" checkbox: checked = automatic, unchecked = manual alpha (preserves legacy behavior).
- UI follows behavior: no input field for a value that has no effect.

### Non-goals (this spec)

- Langmuir–Hinshelwood model (Phase 2, future spec).
- Temkin–Pyzhev model (deferred until ammonia synthesis enters component set).
- Adiabatic mode (Phase 3, future spec — will add isothermal/adiabatic dropdown).
- Multi-reaction networks, selectivity, catalyst deactivation.
- Backward compatibility with saved files.

---

## 1. NNG Updates

### NNG-D2 (revised) — Mandatory kinetics

> A reaction used by a reactor must reference only species present in ComponentRegistry. All referenced species must have formation enthalpy data (Hf_298) for energy balance. Stoichiometry must be mass-balanced (Σ ν_i × MW_i = 0). **All reactions must include a `kinetics` block with a recognized model, valid parameters, and at least one literature reference.** These are checked at registration time, not at runtime.

### NNG-D4 (new) — Registry field completeness

> Every entry in a registry must provide data for all fields defined as required by that registry's schema. Optional fields are permitted but must be explicitly declared as such in the schema definition. No entry may be registered with a required field missing or null. This ensures uniform data availability across all entries and prevents feature-gating based on data presence.

### NNG-C1 (replaced) — No backward compatibility during pre-release

> ~~Old save files must still load. importJSON handles version migration.~~  
> **Backward compatibility is NOT required during pre-release development. This clause will be reinstated when the application reaches its first public release. Until then, saved files may become incompatible across versions without migration support.**

### NNG-C2 (replaced)

> ~~Deprecated fields normalized at runtime, not removed.~~  
> **Removed. See NNG-C1.**

### NNG-C3 (unchanged, clarified)

> No physics changes in structural refactors. If a refactor would change any computed value (temperature, pressure, power, flow), it is a functional change and must be explicitly documented and tested.  
> *Note: Adding kinetics as a new default code path IS a functional change and is documented as such.*

---

## 2. Architecture

### 2.1 No unit duplication

The existing `reactor_equilibrium` unit is extended in-place. No new unit type is created. The decision logic in the tick function becomes:

```
kinetics_available = reaction._kinetics exists
useKinetics = par.useKinetics !== false   (default: true)

if kinetics_available AND useKinetics AND volume_m3 > 0:
    KINETICS MODE (PFR)
    1. Compute xi_eq via existing bisection (unchanged)
    2. Compute Q_inlet = n_total × R × T / P  (ideal gas volumetric flow)
    3. tau_s = volume_m3 / Q_inlet
    4. xi = integratePFR(...)
    5. alpha_effective = xi_eq > 0 ? xi / xi_eq : 0  (diagnostic)
else if NOT useKinetics:
    MANUAL MODE
    xi = clamp(alpha, 0, 1) × xi_eq
else:
    ERROR: volume_m3 ≤ 0 with kinetics enabled → MAJOR error
```

Everything downstream of xi determination — outlet composition, heat duty, heat port sign logic, diagnostics structure — is shared code between both modes.

### 2.2 T_eval simplification

`T_eval_override` is **removed**. For isothermal mode (the only mode in this phase):

- `T_eval = T_in` (always).
- Outlet exits at `T_out = T_in`.
- K is evaluated at `T_in`.

The property editor loses the T_eval field. Results display shows `T (isothermal)` as a read-only diagnostic.

*Rationale*: An isothermal reactor operates at its feed temperature. A separate T_eval was confusing and physically inconsistent. A future isothermal/adiabatic mode selector (out of scope) will handle the adiabatic case properly.

### 2.3 Kinetics checkbox

New boolean parameter: `par.useKinetics` (default: `true`).

- **Checked (default)**: Kinetics active. Volume field visible. Alpha slider hidden.
- **Unchecked**: Manual mode. Alpha slider visible. Volume field hidden.

The checkbox is always visible when a reaction is selected (since all reactions now carry kinetics data per NNG-D2/D4).

### 2.4 Volume parameter

`par.volume_m3` — required reactor parameter.

- **Default**: `1.0` m³ (representative small industrial gas-phase reactor; methanation, partial oxidation, HCl synthesis typically 0.5–5 m³).
- **volume_m3 ≤ 0** with kinetics enabled: **MAJOR error** at solve time. Explicit message: "Reactor volume must be > 0."
- Volume = 0 does NOT silently disable kinetics. It is always an error when kinetics is checked.

---

## 3. ReactionRegistry — Kinetics Schema

### 3.1 `kinetics` field (now required)

```javascript
kinetics: {
  model: 'POWER_LAW',          // String — must be recognized model
  A: Number,                    // pre-exponential [mol/(m³·s·Pa^Σorders)]
  beta: Number,                 // T exponent in k(T) = A·T^β·exp(−Ea/RT)
  Ea_Jmol: Number,              // activation energy [J/mol], ≥ 0
  orders: { species: power },   // partial pressure orders; keys ⊆ stoich keys
  references: [                 // at least one entry required
    { source: String, detail: String }
  ]
}
```

### 3.2 Unit conventions (fixed, no runtime conversion)

| Quantity | Unit | Basis |
|---|---|---|
| Rate | mol/(m³·s) | reactor volume basis |
| Pressure | Pa | consistent with entire codebase (NNG-U1) |
| Temperature | K | consistent with entire codebase (NNG-U1) |
| Activation energy | J/mol | SI |
| Pre-exponential A | mol/(m³·s·Pa^Σorders) | derived from rate/pressure units |

Literature values in other units (bar, kJ/mol, etc.) are **converted at registration time**. No runtime unit switching.

### 3.3 Registration validation (additions)

At `ReactionRegistry.register()` time, the following checks are added:

| Check | Error |
|---|---|
| `kinetics` field missing | throw: "kinetics block required" |
| `kinetics.model` not in recognized set | throw: "unrecognized kinetics model" |
| `kinetics.A` not > 0 | throw: "A must be positive" |
| `kinetics.Ea_Jmol` not ≥ 0 or not finite | throw: "Ea must be non-negative" |
| `kinetics.beta` not finite | throw: "beta must be finite" |
| `kinetics.orders` empty or not object | throw: "orders must be non-empty" |
| Any key in `orders` not in `stoich` | throw: "orders species not in stoichiometry" |
| `kinetics.references` empty or not array | throw: "at least one kinetics reference required" |

The frozen reaction object stores `_kinetics: Object.freeze(kinetics)` alongside existing `_dH0_Jmol`, `_dS0_JmolK`, etc.

### 3.4 Reaction data

**R_H2_COMB** — Hydrogen Combustion:

```javascript
kinetics: {
  model: 'POWER_LAW',
  A: 1.5e5,           // mol/(m³·s·Pa^1.5)
  beta: 0,
  Ea_Jmol: 83000,     // ~83 kJ/mol
  orders: { H2: 1, O2: 0.5 },
  references: [
    { source: 'Marinov et al. 1996 (adapted)',
      detail: 'Int. J. Chem. Kinet. 28, 773-798. Global power-law fit; A/Ea adjusted for single-step equilibrium approach.' }
  ]
}
```

*Note: H₂ combustion at >700 K is effectively instantaneous. These parameters are calibrated so that α_eff > 0.99 at 800 K with V = 1 m³, consistent with the physical expectation that combustion reaches equilibrium rapidly.*

**R_SABATIER** — Sabatier Methanation:

```javascript
kinetics: {
  model: 'POWER_LAW',
  A: 6.15e4,           // mol/(m³·s·Pa^1.5)
  beta: 0,
  Ea_Jmol: 77500,      // ~77.5 kJ/mol
  orders: { CO2: 1, H2: 0.5 },
  references: [
    { source: 'Koschany et al. 2016',
      detail: 'Chem. Eng. J. 307, 264-273. Ni/Al₂O₃, 180-250°C, 1-15 bar. Power-law global rate.' }
  ]
}
```

---

## 4. KineticsEval Namespace

Lightweight, pure-function, no state. Placed in script block 1 (DOM-free core, NNG-A2) after ReactionRegistry, before ModelRegistry. Exported on `PG.KineticsEval`.

### 4.1 Functions

```javascript
const KineticsEval = {

  /**
   * Arrhenius rate constant: k(T) = A · T^β · exp(−Ea/(R·T))
   * Returns 0 on degenerate inputs.
   */
  rateConstant(A, beta, Ea_Jmol, T_K) → number,

  /**
   * Reversible Power Law rate:
   *   r = k(T) × Π(P_i^order_i) × max(0, 1 − Q/K)
   *
   * @param {Object} kinetics  — reaction._kinetics
   * @param {number} T_K       — temperature [K]
   * @param {Object} P_i       — partial pressures { species: Pa }
   * @param {number} K_eq      — equilibrium constant (dimensionless, activity-based)
   * @param {Object} stoich    — reaction stoichiometry { species: nu }
   * @returns {number} rate in mol/(m³·s), always ≥ 0
   */
  ratePowerLaw(kinetics, T_K, P_i, K_eq, stoich) → number,

  /**
   * Dispatch: calls the right model based on kinetics.model.
   * Currently only 'POWER_LAW'. Returns 0 for unrecognized models.
   */
  rate(kinetics, T_K, P_i, K_eq, stoich) → number,
};
```

### 4.2 Driving force: (1 − Q/K)

Q (reaction quotient) is computed from partial pressures using the same thermodynamic formulation as the equilibrium bisection:

```
Q = Π(P_i / P°)^ν_i     where P° = 1e5 Pa (standard pressure)
```

The `max(0, 1 − Q/K)` clamp ensures:
- Rate ≥ 0 always (no reverse reaction in this unit version).
- Rate → 0 smoothly as Q → K (equilibrium approach).
- At equilibrium: rate = 0 exactly.
- Beyond equilibrium (Q > K): rate = 0 (clamped, no overshoot).

### 4.3 Degenerate input handling

| Condition | Behavior |
|---|---|
| T_K ≤ 0 | return 0 |
| Any P_i < 0 | treat as 0 |
| P_i = 0 for a species with positive order | return 0 (rate killed) |
| K_eq ≤ 0 | return 0 |
| A ≤ 0 | return 0 (should not happen if validation passes) |

No warnings, no error objects. Returns 0 silently. Validation at registration time (NNG-D2) prevents bad data from reaching here.

---

## 5. PFR Integrator

### 5.1 Function signature

```javascript
/**
 * Integrate dξ/dτ = r(ξ) from ξ=0 to τ=tau_s using RK4.
 * Clamps ξ ≤ xi_eq at every step. Returns final ξ.
 *
 * @param {string} reactionId
 * @param {Object} kinetics   — reaction._kinetics
 * @param {number} T_K        — isothermal temperature
 * @param {number} P_total    — total pressure [Pa]
 * @param {Object} n_in       — inlet molar flows { species: mol/s }
 * @param {Object} stoich     — { species: nu }
 * @param {number} xi_eq      — equilibrium extent [mol/s]
 * @param {number} tau_s      — residence time [s]
 * @returns {number} xi in [0, xi_eq]
 */
function integratePFR(kinetics, T_K, P_total, n_in, stoich, xi_eq, tau_s) → number
```

### 5.2 Algorithm

1. **Short-circuits**:
   - If `xi_eq ≤ 0` → return 0.
   - If `tau_s ≤ 0` → return 0.
   - If `tau_s > 1e6` → return xi_eq (infinite residence time → equilibrium).

2. **RK4 integration** with N = 10 fixed steps:
   - `dt = tau_s / N`
   - For each step, compute standard RK4 (k1, k2, k3, k4) where the derivative is `r(xi_current)`.
   - The rate function at extent ξ:
     - Compute `n_i(ξ) = n_in_i + ν_i × ξ` for each species.
     - Compute `n_total(ξ) = Σ n_i(ξ)`.
     - Compute `P_i(ξ) = (n_i / n_total) × P_total`.
     - Compute `K_eq = exp(lnK)` from `ReactionRegistry.lnK(reactionId, T_K)`.
     - Call `KineticsEval.rate(kinetics, T_K, P_i, K_eq, stoich)`.
     - The rate is in mol/(m³·s). Since the ODE is in the τ domain (time), we need: `dξ/dτ = r × V / V = r` ... but actually ξ is in mol/s (molar extent flow), and r is mol/(m³·s), so `dξ/dτ = r × V`... No — let me be precise:
     
     **ODE derivation**:
     - ξ has units of mol/s (molar extent per unit time, consistent with the existing bisection).
     - r has units of mol/(m³·s) (volumetric rate).
     - τ has units of s (residence time = V/Q).
     - The PFR design equation: `dξ/dV = r` where V is reactor volume.
     - Reparametrize: `V = Q × τ` where Q = volumetric flow (m³/s), so `dV = Q × dτ`.
     - Therefore: `dξ/dτ = r × Q`.
     - But Q = V_total / tau_s (constant for ideal gas at fixed T, P, approximately).
     
     **Simplification for this implementation**: Since we're integrating over the full volume, we can equivalently integrate:
     - `dξ/dV_frac = r × V_total` where V_frac ∈ [0, 1] (fractional volume).
     - Or more directly: just use `dξ = r(ξ) × dV` and step through volume in N steps.
     - `dV = volume_m3 / N` per step.

     **Revised**: The integrator steps through **volume** (not time), since the PFR design equation is naturally `dξ/dV = r(ξ)`:
     
     ```
     V_step = volume_m3 / N
     for each step:
       k1 = r(xi) × V_step
       k2 = r(xi + k1/2) × V_step
       k3 = r(xi + k2/2) × V_step
       k4 = r(xi + k3) × V_step
       xi += (k1 + 2k2 + 2k3 + k4) / 6
       xi = min(xi, xi_eq)   // equilibrium clamp
       if rate ≤ 0: break    // equilibrium reached
     ```

3. **Post-clamp**: Final `xi = clamp(xi, 0, xi_eq)`.

### 5.3 Revised function signature

```javascript
function integratePFR(kinetics, T_K, P_total, n_in, stoich, xi_eq, volume_m3, lnK) → number
```

tau_s is not needed as an input — it's a diagnostic computed separately in the tick (`tau = V / Q`).

### 5.4 Performance

10 RK4 steps = 40 rate evaluations per tick. Each rate evaluation involves:
- ~6 multiplications (partial pressures)
- 1 exp() call (Arrhenius, but K_eq can be precomputed once)
- ~4 multiplications (power law)

Total: ~240 FLOPs per tick. Negligible even in a 200-iteration recycle loop.

### 5.5 Edge cases

| Condition | Behavior |
|---|---|
| Very large volume (V → ∞) | xi → xi_eq (rate → 0 near equilibrium, RK4 converges) |
| Very small volume (V → 0) | xi ≈ r(0) × V (linear regime, one tiny step) |
| Zero volume (V = 0) | Not reached — caught by MAJOR error before integration |
| n_total = 0 | Q = 0, tau = ∞; but xi_max = 0 so bisection returns xi_eq = 0 → integrator returns 0 |
| Missing reactant | xi_max = 0, caught before bisection → xi = 0 |
| Product-heavy feed (Q > K) | Bisection returns xi_eq = 0 → integrator returns 0 |

---

## 6. Reactor Tick Changes (reactor_equilibrium)

### 6.1 Parameter changes

| Parameter | Before | After |
|---|---|---|
| `reactionId` | required | required (unchanged) |
| `alpha` | default 1.0 | retained, only used when useKinetics = false |
| `T_eval_override` | optional | **removed** |
| `useKinetics` | — | **new**, default `true` |
| `volume_m3` | — | **new**, default `1.0` |

### 6.2 Default params (Scene.addUnit)

```javascript
case 'reactor_equilibrium':
  unit.params = { reactionId: 'R_H2_COMB', useKinetics: true, volume_m3: 1.0, alpha: 1.0 };
  break;
```

### 6.3 Tick logic (pseudocode)

```
Guards: no reaction, VL inlet, activation window, thermo data  (unchanged)
Compute xi_max from limiting reactant                           (unchanged)
Compute T_eval = sIn.T                                          (CHANGED: was par.T_eval_override ?? sIn.T)
Compute ln_K at T_eval                                          (unchanged)
Bisection → xi_eq                                               (unchanged)

── NEW: kinetics vs manual branch ──
if reaction._kinetics AND par.useKinetics !== false:
    if par.volume_m3 <= 0:
        MAJOR error: "Reactor volume must be > 0"
        pass-through outlet
        return
    
    Q_inlet = n_total_in × R × T_eval / P_in        (ideal gas)
    tau_s = volume_m3 / Q_inlet                       (residence time)
    xi = integratePFR(reaction._kinetics, T_eval, P_in, sIn.n, stoich, xi_eq, volume_m3, ln_K)
    alpha_effective = xi_eq > 0 ? xi / xi_eq : 0
    limited_by = alpha_effective > 0.95 ? 'equilibrium' : 'kinetics'
    rate_inlet = KineticsEval.rate(...)               (at inlet composition)
    rate_outlet = KineticsEval.rate(...)              (at outlet composition)
    mode = 'kinetics'
else:
    xi = clamp(par.alpha ?? 1.0, 0, 1) × xi_eq
    alpha_effective = par.alpha ?? 1.0
    mode = 'manual'

── Outlet composition ──                                        (unchanged)
── Isothermal outlet: T_out = T_eval ──                         (unchanged)
── Q_duty: H_out − H_in ──                                     (unchanged)
── Heat port: cooling/heating sign logic ──                     (unchanged)
── Diagnostics ──                                               (extended)
```

### 6.4 Diagnostics (`u.last`)

Kinetics mode adds:
```javascript
{
  mode: 'kinetics',
  useKinetics: true,
  volume_m3: par.volume_m3,
  tau_s,
  rate_inlet,       // mol/(m³·s)
  rate_outlet,      // mol/(m³·s)
  alpha_effective,  // xi / xi_eq
  limited_by,       // 'kinetics' | 'equilibrium'
  // ... plus existing shared fields:
  // reactionId, xi, xi_max, xi_eq, ln_K, T_eval,
  // Q_duty_W, Q_duty_sign, H_in_kW, H_out_kW, dH0, dS0
}
```

Manual mode:
```javascript
{
  mode: 'manual',
  useKinetics: false,
  alpha: par.alpha,
  // ... plus existing shared fields
}
```

---

## 7. UI Changes

### 7.1 Property editor (reactor_equilibrium parameters section)

```
Parameters
├─ Reaction:      [dropdown — all registered reactions]
├─ Equation:      CO₂ + 4 H₂ ⇌ CH₄ + 2 H₂O  (styled, read-only)
├─ ☑ Kinetics     (checkbox, default checked)
│
├─ [if kinetics checked]:
│     Volume (m³):  [1.0]    (number input)
│
├─ [if kinetics unchecked]:
│     Alpha:        [====○====]  (slider, 0–1)
```

**Removed**: T_eval field (was below reaction selector).

**Rule**: No input field for a value that has no effect. Volume only shows when kinetics is checked. Alpha only shows when kinetics is unchecked.

### 7.2 Results display (properties section, kinetics mode)

```
⚗️ Reactor (Eq.) — active
  CO₂ + 4 H₂ ⇌ CH₄ + 2 H₂O

  ┌─────────────────────────────────┐
  │ Mode          Kinetics (PFR)    │
  │ α_effective   0.87              │
  │ Limited by    Kinetics          │
  │ ξ / ξ_eq      0.041 / 0.047    │
  │ τ             1.84 s            │
  │ Volume        2.0 m³           │
  │ Rate (in)     1.23e-2           │
  │ Rate (out)    3.1e-3            │
  │ ln K          12.4              │
  │ T (isothermal) 523 K           │
  └─────────────────────────────────┘
  ───── progress bar (ξ/ξ_max) ─────
```

Manual mode shows: Mode = Manual, Alpha = 0.50, ln K, T, ξ/ξ_max. No tau, rate, volume, limited_by.

### 7.3 Reaction Library viewer

Each reaction card gains a "Kinetics" subsection:

```
Kinetics: Reversible Power Law
  k(T) = 6.15×10⁴ · exp(−77 500 / RT)
  Orders: P_CO₂¹·⁰ · P_H₂⁰·⁵
  Driving force: (1 − Q/K)
  Rate basis: mol/(m³·s)

  Source: Koschany et al. 2016
  Chem. Eng. J. 307, 264-273. Ni/Al₂O₃, 180-250°C, 1-15 bar.
```

---

## 8. Demo Scene (Phase 6)

Realistic Sabatier power-to-gas plant with kinetics-active reactor.

| Parameter | Value | Rationale |
|---|---|---|
| Feed composition | CO₂:1, H₂:4 mol/s | Stoichiometric Sabatier feed |
| Feed T | 523 K (250°C) | Top of Koschany validity range |
| Feed P | 10 bar (1 MPa) | Typical methanation pressure |
| Reactor volume | 2.0 m³ | Small industrial scale |
| Reactor kinetics | ON (default) | Demonstrates kinetics-limited regime |
| Cooler T_out | 323.15 K (50°C) | Condense H₂O |
| Recycle split | 85% | Same as before |
| Solver maxIter | 200 | Recycle convergence |

At 523 K with 2 m³, the reactor should be clearly kinetics-limited (α_eff < 1), demonstrating the value of the kinetics model. The recycle loop compensates for per-pass conversion being below equilibrium.

---

## 9. Test Plan

### 9.1 Existing tests modified

These tests currently pass `alpha: 1.0` (or implicitly default to it) and some use `T_eval_override`. They must be updated to use `useKinetics: false` to exercise the manual path, and `volume_m3: 1.0` (even though irrelevant in manual mode, keeps params complete). `T_eval_override` references are removed.

| # | Test name | Changes |
|---|---|---|
| 127 | Reactor Eq. — products strongly favored | Add `useKinetics: false, volume_m3: 1.0` |
| 128 | Reactor Eq. — alpha scaling | Add `useKinetics: false, volume_m3: 1.0` |
| 129 | Reactor Eq. — T_eval override | **REMOVED** (T_eval_override no longer exists) |
| 130 | Reactor Eq. — Q_duty energy closure | Add `useKinetics: false, volume_m3: 1.0` |
| 131 | Reactor Eq. — heat_out in system balance | Add `useKinetics: false, volume_m3: 1.0` |
| 132 | Reactor Eq. — VL inlet rejected | Add `useKinetics: false, volume_m3: 1.0` |
| 133 | Sabatier — equilibrium at 800 K | Add `useKinetics: false, volume_m3: 1.0` |
| 134 | Sabatier — K crossover | Add `useKinetics: false, volume_m3: 1.0` |
| 136 | Sabatier recycle convergence | Add `useKinetics: false, volume_m3: 1.0` |
| 137 | Balance report — reactor scene | Adapts to new demo scene (Phase 6) |

### 9.2 New tests (13 total)

**Registry validation (Phase 1, 2 tests):**

| # | Test | Description |
|---|---|---|
| T1 | Registry: kinetics validation — valid | R_H2_COMB and R_SABATIER have _kinetics, model=POWER_LAW, A>0, references non-empty |
| T2 | Registry: kinetics validation — rejects bad | Missing kinetics → throw; A≤0 → throw; bad model → throw; orders referencing non-stoich species → throw |

**KineticsEval + PFR (Phase 2, 4 tests):**

| # | Test | Description |
|---|---|---|
| T3 | KineticsEval.rateConstant | Known Arrhenius at 500 K and 800 K matches hand calculation |
| T4 | KineticsEval.ratePowerLaw | Known rate at fixed T, P_i, K_eq; verify (1−Q/K)→0 at equilibrium gives rate→0 |
| T5 | KineticsEval degenerate | Zero partial pressure → 0; Q > K → 0; T ≤ 0 → 0 |
| T6 | integratePFR basic | Large volume → xi ≈ xi_eq; small volume → xi << xi_eq; xi_eq=0 → xi=0 |

**Reactor tick kinetics (Phase 3, 7 tests):**

| # | Test | Description |
|---|---|---|
| T7 | Kinetics: large volume → equilibrium | V = 100 m³, α_eff > 0.99, matches manual α=1.0 within tolerance |
| T8 | Kinetics: small volume → kinetics-limited | V = 0.001 m³, α_eff < 0.1, xi << xi_eq |
| T9 | Kinetics: zero volume → MAJOR error | volume_m3 = 0 → u.last.error with severity MAJOR |
| T10 | Kinetics: missing reactant → xi = 0 | Feed with no CO₂ → xi_max = 0, xi = 0 |
| T11 | Kinetics: golden number Sabatier | T=500K, P=10bar, stoichiometric, V=1m³ → expected xi, α_eff ±5% |
| T12 | Kinetics: H₂ combustion fast | T=800K, P=1bar, V=1m³ → α_eff > 0.99 (effectively instantaneous) |
| T13 | Kinetics: Sabatier recycle | Small recycle flowsheet with kinetics ON, converges, mass/energy balanced |

---

## 10. Phased Implementation Plan

### Phase 0 — NNG + Demo Placeholder (v8.9.3)

**Scope**: NNG updates. Replace demo scene with minimal source→sink placeholder (prevents demo from breaking during intermediate phases).

**Changes**:
1. Update NNG block: revise D2, add D4, replace C1/C2.
2. Replace `loadDemo()` body with a simple source→sink scene.
3. Verify all 140 existing tests still pass.

**Deliverable**: Working file, all tests green.

---

### Phase 1 — Registry + Kinetics Data (v8.9.4)

**Scope**: Extend ReactionRegistry validation to require `kinetics`. Add kinetics data to both reactions. Update Reaction Library viewer.

**Changes**:
1. Add kinetics validation to `ReactionRegistry.register()`.
2. Add `kinetics` blocks to R_H2_COMB and R_SABATIER registration.
3. Store `_kinetics` on frozen reaction object.
4. Update `buildReactionsPanel()` to show kinetics section (model, formula, params, citations).
5. Update existing registry validation tests that register bad reactions (they now also need a valid `kinetics` block to avoid the new validation triggering before the intended failure).
6. Add tests T1, T2.

**Deliverable**: Working file, all tests green (old + 2 new).

---

### Phase 2 — KineticsEval + PFR Integrator (v8.9.5)

**Scope**: Implement the kinetics evaluation namespace and PFR integrator. Pure computation, no tick changes yet.

**Changes**:
1. Implement `KineticsEval` namespace (rateConstant, ratePowerLaw, rate).
2. Implement `integratePFR()` function.
3. Export both on PG namespace.
4. Add tests T3, T4, T5, T6.

**Deliverable**: Working file, all tests green (old + 4 new).

---

### Phase 3 — Reactor Tick + UI + Test Implementation (v8.9.6)

**Scope**: Extend reactor tick with kinetics branch. Update UI. Write all remaining tests. **Tests are implemented but NOT run during this phase** (to avoid long debugging cycles in a single thought).

**Changes**:
1. Remove `T_eval_override` from tick logic; set `T_eval = sIn.T`.
2. Add kinetics/manual branch after bisection.
3. Volume validation (≤ 0 → MAJOR error).
4. Extended diagnostics (mode, tau, rates, alpha_effective, limited_by).
5. Update default params for reactor_equilibrium.
6. UI: kinetics checkbox, conditional Volume/Alpha fields, remove T_eval editor.
7. UI: extended results display for kinetics mode.
8. Modify existing tests (add `useKinetics: false, volume_m3: 1.0`; remove T_eval override test).
9. Implement new tests T7–T13.
10. **Do NOT run tests** — leave for Phase 4.

**Deliverable**: File with all code changes and test implementations. Tests not verified.

---

### Phase 4 — Verification & Troubleshooting (v8.9.7)

**Scope**: Run all tests. Debug and fix any failures. Iterate until all tests pass.

**Changes**:
1. Run full test suite.
2. Debug failures — fix tick logic, integration parameters, test expectations.
3. Iterate until all tests green.
4. Verify test count is as expected.

**Deliverable**: Working file, all tests green (old modified + 13 new).

---

### Phase 5 — Demo Process (v8.9.8)

**Scope**: Rebuild the demo scene as a realistic Sabatier plant with kinetics.

**Changes**:
1. Rebuild `loadDemo()` with parameters from Section 8.
2. Verify demo converges, mass/energy balanced.
3. Update balance report test if needed (it references demo scene structure).
4. Final test run — all tests green.

**Deliverable**: Final working file, all tests green, demo scene functional with kinetics.

---

## Appendix A — File Locations

All work is on the single working copy:
- Source: `/home/claude/processThis.html`
- Output: `/mnt/user-data/outputs/processThis.html`

## Appendix B — Version Map

| Version | Phase | Description |
|---|---|---|
| v8.9.3 | Phase 0 | NNG updates, demo placeholder |
| v8.9.4 | Phase 1 | Registry kinetics schema + data |
| v8.9.5 | Phase 2 | KineticsEval + PFR integrator |
| v8.9.6 | Phase 3 | Reactor tick + UI + tests (unverified) |
| v8.9.7 | Phase 4 | Verification & troubleshooting |
| v8.9.8 | Phase 5 | Demo process rebuild |

## Appendix C — Future Phases (out of scope)

- **Langmuir–Hinshelwood**: Add `rateLH()` to KineticsEval, extend registry schema with `adsorption` + `m`. Add canonical LH reaction with citations.
- **Adiabatic mode**: Isothermal/Adiabatic dropdown selector on reactor. Coupled T-ξ integration or iterative T_out solve.
- **Temkin–Pyzhev**: Deferred until ammonia synthesis enters component/reaction set.
