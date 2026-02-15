# DESIGN: Reactor Refactor — Equilibrium Separation & Adiabatic Cleanup

**Version**: 1.0  
**Date**: 2026-02-15  
**Target versions**: v8.8.0 (Phase 1+2), v8.9+ (Phase 3)  
**Status**: ✅ Phase 1+2 IMPLEMENTED (v8.8.0) · ⬜ Phase 3 SPECIFIED

---

## 0. Motivation

Code review identified a physical inconsistency: equilibrium mode computes
K at T_in, then applies adiabatic energy closure at T_out.  For strongly
exothermic reactions the outlet temperature can be thousands of Kelvin
higher than the inlet, where K is significantly different.  The current
code produces correct answers for H₂ combustion (K is astronomical at all
temperatures) but would produce silently wrong results for less extreme
reactions (water-gas shift, ammonia synthesis, partial oxidation).

Rather than deleting working code, we separate the two reactor models into
distinct units with honest contracts.

---

## Phase 1: Move Equilibrium Code to `reactor_equilibrium` (WIP Stub)

### 1.1 What moves

The entire `mode === 'equilibrium'` branch from `reactor_adiabatic.tick()`:
- ΔH°/ΔS° computation from ComponentRegistry
- van 't Hoff K(T_eval)
- Bisection solver for ξ_eq
- Alpha scaling
- All equilibrium diagnostics (_eqDiag)

### 1.2 New unit registration

```
UnitRegistry.register('reactor_equilibrium', {
  name: 'Reactor (Equilibrium)',
  category: UnitCategories.REACTOR,
  w: 2, h: 3,
  ports: [
    { portId: 'mat_in',  dir: PortDir.IN,  type: StreamType.MATERIAL, x:0, y:1 },
    { portId: 'mat_out', dir: PortDir.OUT, type: StreamType.MATERIAL, x:2, y:1 }
  ],
  tick(u, ports, par) { ... }
});
```

**Icon**: Reactor vessel with ⇌ (equilibrium arrows) instead of >> (flow
chevrons).  Same rounded-rect shape, different interior symbol.

**Default params**: `{ reactionId: 'R_H2_COMB', alpha: 1.0 }`  
No `mode` (only equilibrium), no `T_eval_override` (uses T_in), no `P_out`.

### 1.3 Stub energy contract

The stub preserves the current (inconsistent) behavior:
- K evaluated at `par.T_eval_override ?? sIn.T`
- Adiabatic energy closure: `H_target_Jps = H_in`

This is **intentionally preserved** — the code works, it's tested, and the
inconsistency is documented.  The stub exists to hold the code until Phase 3
replaces the energy contract.

### 1.4 WIP marking

The unit displays a persistent banner in the property panel:

```
⚠ WIP — Equilibrium evaluated at T_in, energy closure at T_out.
Physically inconsistent for reactions where K varies significantly
with temperature.  Use fixed-conversion adiabatic reactor for
production work.
```

The unit also carries `_wip: true` in its registration, which:
- Adds a "(WIP)" suffix in the palette
- Renders a dashed border on the canvas icon
- Is queryable by tests

### 1.5 Test migration

Tests 124–126 retarget from `reactor_adiabatic` to `reactor_equilibrium`.
They continue to pass unchanged (same code, different defId).

The test section header becomes:

```
SECTION AF: Reactor Equilibrium WIP (Tests 124–126)
[v8.8.0] Moved from reactor_adiabatic. Tests validate the stub's
behavior (K at T_in + adiabatic closure). Will be updated in Phase 3
when energy contract changes to isothermal.
```

### 1.6 UI

- Reaction selector (same as current)
- Styled equation display (same as current)
- Alpha slider 0–1 (same as current)
- T_eval number input with help text (same as current)
- No mode selector (only equilibrium)
- No P_out
- WIP banner at top of Parameters section

### 1.7 Property panel (results)

Same as current equilibrium results display:
- Reaction equation, mode "K(T) Equilibrium", ln K, T_eval, alpha
- ξ / ξ_max with progress bar
- WIP banner persists in results view

### 1.8 Demo scene

Change demo reactor from `mode: 'equilibrium'` to `mode: 'fixed'`
(or change defId to `reactor_equilibrium`).  Recommendation: switch
demo to fixed-conversion adiabatic since it's the "production" unit.

---

## Phase 2: Clean Up `reactor_adiabatic`

### 2.1 Tick simplification

Remove from tick:
- Entire `mode === 'equilibrium'` branch
- `const P_out = par.P_out ?? sIn.P` → use `sIn.P` directly
- `_eqDiag` storage
- Entropy check
- ComponentRegistry access (only thermo.getHdot_Jps remains)

What remains:
```
tick(u, ports, par):
  1. Guard: reaction selected
  2. Activation window (inlet T/P)
  3. ξ_max from limiting reactant
  4. ξ = conversion × ξ_max
  5. n_out from stoichiometry
  6. H_in = thermo.getHdot_Jps(sIn)
  7. Emit {P: sIn.P, n: n_out, H_target_Jps: H_in}
  8. Diagnostics
```

This is a clean, physically honest unit: "apply specified extent of
reaction, conserve enthalpy."  No pressure change, no equilibrium
assumptions, no layering violations.

### 2.2 Default params

```
{ reactionId: 'R_H2_COMB', conversion: 0.5 }
```

No `mode` key (fixed conversion is the only mode).

### 2.3 UI simplification

- Reaction selector + styled equation
- Conversion slider 0–1
- No mode selector
- No alpha
- No T_eval
- No P_out

### 2.4 New test: VL inlet guard

Policy: **reject with MAJOR error**.  Rationale: gas-phase reaction
kinetics are qualitatively different from liquid-phase; treating total
moles of a two-phase mixture as available for gas-phase reaction is
wrong.  A proper multiphase reactor is a separate unit for the future.

The guard checks inlet phaseConstraint and/or the presence of liquid
fraction.  If VL or L, emit MAJOR error + pass-through.

Test: place reactor with VL inlet, verify error and unchanged outlet.

### 2.5 New test: T_out beyond flash bracket

Feed a stoichiometric H₂/O₂ mixture (no diluent) at high conversion.
The adiabatic flame temperature exceeds the Cp polynomial range.
Verify:
- PH-flash fails gracefully (not NaN, not hang)
- Error is MAJOR (not CATASTROPHIC)
- Outlet stream is still emitted (clamped or pass-through)

This tests the robustness boundary of the unit.

---

## Phase 3: Physically Correct Equilibrium Reactor (Specification)

### 3.1 Energy contract: isothermal at T_eval

The correct simple equilibrium reactor is **isothermal**:

```
Given:  T_eval (user parameter or default T_in)
Find:   ξ_eq such that Q(ξ, T_eval) = K(T_eval)
Output: n_out at ξ = α × ξ_eq, T_out = T_eval
Report: Q_duty = H_out(n_out, T_eval) − H_in
```

This is physically clean:
- Equilibrium and temperature are consistent (K evaluated at the actual
  reactor temperature)
- The heat duty tells the user what external heating/cooling is needed
- No nested iteration — single bisection for ξ, then one enthalpy
  evaluation for Q_duty

### 3.2 Port change: add heat_out

```
ports: [
  { portId: 'mat_in',  dir: PortDir.IN,  type: StreamType.MATERIAL, x:0, y:1 },
  { portId: 'mat_out', dir: PortDir.OUT, type: StreamType.MATERIAL, x:2, y:1 },
  { portId: 'heat_out', dir: PortDir.OUT, type: StreamType.HEAT, x:1, y:3 }
]
```

`heat_out` emits `{ type: HEAT, available: |Q_duty|, actual: |Q_duty| }`.

- If Q_duty > 0: reactor needs heating (endothermic net, or exothermic
  but T_eval < adiabatic T_out — heat must be removed)
- If Q_duty < 0: reactor releases heat (exothermic, T_eval < natural T_out)

Sign convention: heat_out.available is always ≥ 0 (magnitude).  The
results display shows whether it's heating or cooling duty.

If heat_out is **unconnected**: Q_duty appears as dissipated heat in the
system balance (same as motor/generator losses).  This is correct — the
heat exists whether or not it's captured.

If heat_out is **connected** to a heat sink or heat exchanger: the
downstream unit sees the available heat and can use it.

### 3.3 Outlet stream: direct TP, no PH-flash

Unlike the adiabatic reactor (which emits H_target_Jps for the solver to
PH-flash), the isothermal reactor knows its outlet temperature.  It emits:

```
ports.mat_out = {
  type: StreamType.MATERIAL,
  T: T_eval,
  P: sIn.P,
  n: n_out,
  phaseConstraint: sIn.phaseConstraint || 'V'
};
```

No PH-flash needed.  Simpler and faster.

### 3.4 Pressure in Q calculation

Use `sIn.P` (dP = 0) for the equilibrium Q computation:

```
ln Q = Σ νᵢ × ln(yᵢ × P / P_std)
```

where P = sIn.P.  This is correct because P_out = P_in (no pressure
change in the reactor).

### 3.5 Move ΔH°/ΔS° to ReactionRegistry

At registration time, precompute and store:

```
_dH0_Jmol:  Σ νᵢ × hf0_Jmol     (standard enthalpy of reaction)
_dS0_JmolK: Σ νᵢ × s0_JmolK     (standard entropy of reaction)
_delta_nu:   Σ νᵢ               (change in moles, for pressure effects)
```

Add a helper method:

```
ReactionRegistry.lnK(id, T_K) → number
  const rxn = this.get(id);
  return -rxn._dH0_Jmol / (8.314 * T_K) + rxn._dS0_JmolK / 8.314;
```

Benefits:
- Reactor tick no longer touches ComponentRegistry (clean layering)
- Reaction Library viewer reads stored values (no recomputation)
- Future thermo packages can override the computation
- `_delta_nu` useful for pressure-dependence diagnostics

### 3.6 Tick pseudocode (Phase 3)

```
tick(u, ports, par):
  sIn = ports.mat_in
  if !sIn → return

  reaction = ReactionRegistry.get(par.reactionId)
  if !reaction → error + pass-through

  // Activation window
  if T_in or P_in outside window → inactive + pass-through

  // T_eval
  T_eval = par.T_eval_override ?? sIn.T

  // ξ_max
  xi_max = limiting reactant calculation (same as current)

  // K(T_eval)
  ln_K = ReactionRegistry.lnK(par.reactionId, T_eval)

  // Bisection: find ξ_eq where ln_Q(ξ) = ln_K
  // (same bisection code as current, but using sIn.P for Q)
  xi_eq = bisect(...)
  xi = alpha × xi_eq

  // Outlet composition
  n_out = apply stoichiometry(sIn.n, stoich, xi)

  // Outlet stream at T_eval (isothermal)
  ports.mat_out = { T: T_eval, P: sIn.P, n: n_out, ... }

  // Q_duty
  H_in = thermo.getHdot_Jps(sIn)
  outProxy = { T: T_eval, P: sIn.P, n: n_out, ... }
  H_out = thermo.getHdot_Jps(outProxy)
  Q_duty_W = H_out - H_in  // positive = needs heating

  // Heat port
  ports.heat_out = {
    type: StreamType.HEAT,
    available: Math.abs(Q_duty_W),
    actual: Math.abs(Q_duty_W)
  }

  // Diagnostics
  u.last = { ..., Q_duty_W, T_eval, ln_K, xi_eq, ... }
```

### 3.7 UI changes from stub

- Remove WIP banner
- Add Q_duty display in results (with sign indication: heating/cooling)
- Add T_eval as prominent parameter (not hidden "override")
- Label: "Reactor (Equilibrium)" without "(WIP)"

### 3.8 Test plan for Phase 3

| # | Test | Validates |
|---|------|-----------|
| 124' | K(T) products favored, T_eval=T_in | ξ_eq ≈ ξ_max, composition correct |
| 125' | Alpha scaling | ξ = α × ξ_eq, intermediate composition |
| 126' | T_eval override | K changes with T_eval, Q_duty changes sign/magnitude |
| NEW | Q_duty sign check | Exothermic rxn at T_eval < adiabatic → Q_duty < 0 (cooling needed) |
| NEW | Q_duty energy closure | H_in + Q_duty = H_out (within tolerance) |
| NEW | Heat port routing | Q_duty appears in system balance as connected heat or dissipated |
| NEW | Pressure in Q | Δν ≠ 0 reaction: verify ξ_eq shifts with P in correct direction |
| NEW | VL inlet guard | Same as Phase 2 adiabatic |

### 3.9 Future: Coupled Adiabatic Equilibrium (Phase 4, not specified here)

For completeness, this would be a mode on `reactor_equilibrium`:

```
mode: 'adiabatic'  →  find ξ such that:
  ln Q(ξ, T_out(ξ)) = ln K(T_out(ξ))  AND  H_out(n_out, T_out) = H_in
```

Implementation: outer bisection on ξ, inner PH-flash for T_out(ξ).
~3600 polynomial evaluations, ~1ms.  heat_out would emit 0 (adiabatic).

Not specified here because the isothermal reactor covers the immediate
need, and Phase 4 requires careful edge-case handling (reaction quenching
itself, multiple solutions, etc.).

---

## Summary: What Changes When

| Item | Phase 1 (stub) | Phase 2 (cleanup) | Phase 3 (correct) |
|------|----------------|--------------------|--------------------|
| `reactor_adiabatic` tick | Remove eq branch | Simplify (conv only) | — |
| `reactor_equilibrium` tick | Copy eq code | — | Rewrite (isothermal) |
| `reactor_equilibrium` ports | mat_in, mat_out | — | + heat_out |
| P_out in reactor_adiabatic | Remove | Enforce sIn.P | — |
| T_eval_override | Move to eq reactor | Remove from adiabatic | Promote to primary param |
| Mode selector (adiabatic) | Remove eq option | Remove entirely | — |
| ComponentRegistry in tick | Move to eq stub | Gone from adiabatic | Gone (use ReactionRegistry) |
| ReactionRegistry._dH0 | — | — | Add at registration |
| Tests 124–126 | Retarget to eq unit | — | Rewrite for isothermal |
| New tests | — | VL guard, T_out safety | Q_duty, pressure, closure |
| Demo scene | Switch to fixed conv | — | — |
| WIP banner | Add | — | Remove |
| Icon | New (⇌ arrows) | — | — |

---

## Implementation Estimate

| Phase | Scope | Test count |
|-------|-------|------------|
| Phase 1 | New unit registration, move code, icon, WIP UI, retarget tests | ~0 new tests (migration) |
| Phase 2 | Simplify adiabatic tick, remove dead code, 2 new tests | +2 tests (VL guard, T_out safety) |
| Phase 3 | Rewrite eq tick (isothermal), heat port, ReactionRegistry helpers, rewrite + new tests | ~6 rewritten/new tests |

Phases 1+2 ship together as v8.8.0.  Phase 3 is v8.9 or v9.0.

---

*End of specification. Awaiting discussion.*
