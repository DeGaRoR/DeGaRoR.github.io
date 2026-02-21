# Heat Stream Deletion — Design Document
## v11.3.0 Phase 0 (Pre-requisite for all other v11.3 work)

---

## Summary

Remove `StreamType.HEAT` entirely. Replace the electric_heater +
heater two-unit pattern with a single inline electric process
heater. Replace the cooler (cheat unit, 2nd-law violation) with
a physically-grounded air cooler. Update the heated reactor to
use an electrical port. Retire electric_heater, sink_heat, cooler.

**Why first:** Every subsequent change (limits, performance maps,
alarm sources, tests) references unit port layouts. Changing ports
after those systems are built means double work.

---

## Motivation

### What's wrong with heat streams

1. **No physical object corresponds to them.** There is no "heat
   pipe" in chemical engineering. Heat transfers through conduction,
   convection, radiation, or electrical resistance — all involve
   real physical media. A heat stream is a dimensionless number
   pretending to be a pipe.  This violates the new NNG-3 clause:
   every palette item must correspond to a physical, identifiable
   piece of equipment.

2. **The two-unit heating pattern is confusing.** To heat a fluid
   electrically, the player places electric_heater → heater and
   wires them. New players don't understand why two boxes are
   needed for "make fluid hot."

3. **The cooler violates the 2nd law.** It has a T_out setpoint
   with no constraint against ambient temperature. Nothing prevents
   cooling to 10K when the planet is at 288K. This is magic.

4. **Unnecessary complexity.** Heat stream propagation in the
   solver, validation in STREAM_CONTRACTS, rendering in the
   connection drawer, the sink_heat unit — all support an
   abstraction that teaches the wrong thing.

### What replaces it

| Old | New | Physical object |
|-----|-----|-----------------|
| electric_heater + heater (2 units) | heater (1 unit) | Inline electric process heater |
| cooler + sink_heat (2 units) | air_cooler (1 unit) | Fin-fan air cooler |
| reactor heat_in (HEAT port) | reactor elec_in (ELEC port) | Electrically jacketed reactor |
| HEX | unchanged | Plate or coil-in-shell exchanger |

---

## Unit Specifications

### heater — Inline Electric Process Heater (REWRITTEN)

**Physical equipment:** SS316L housing with ceramic resistance
heating elements. PID-controlled outlet temperature. Like a
Watlow or Chromalox inline heater. Standard pilot-plant equipment.

```
Ports: mat_in (MATERIAL), elec_in (ELECTRICAL) → mat_out (MATERIAL)
Category: HEAT_EXCHANGER
Params: T_out (K, default 423.15 = 150°C)
```

**Behavior:**
- Computes Q_duty = H(T_out, P, n) − H(T_in, P, n)
- Sets powerDemand = Q_duty (η = 1.0 for resistance heating)
- Draws from elec_in via hub allocation
- If curtailed (W_actual < Q_duty): H_out = H_in + W_actual.
  PH-flash resolves actual T_out. Inspector shows actual vs
  setpoint. Physically correct: less power = less heating.
- If elec_in not connected: T_out = T_in, passthrough + MAJOR
  error "No electrical supply"
- If T_out setpoint < T_in: WARNING "Use air cooler for cooling"
  + passthrough

**Tick sketch:**
```js
tick(u, ports, par, ctx) {
  const sIn = ports.mat_in;
  if (!sIn) return;

  const H_in = thermo.getHdot_Jps(sIn);
  const T_set = par.T_out ?? (sIn.T + 50);

  // Can't cool
  if (T_set < sIn.T - 0.01) {
    u.last = { error: MAJOR('Use air cooler for cooling') };
    ports.mat_out = passthrough(sIn, H_in);
    return;
  }

  // Target enthalpy
  const H_target = thermo.getHdot_Jps({ T: T_set, P: sIn.P, n: sIn.n });
  const Q_duty = Math.max(0, H_target - H_in);

  // Power allocation
  u.powerDemand = Q_duty;
  const sElec = ports.elec_in;
  if (!sElec) {
    u.last = { error: MAJOR('No electrical supply') };
    ports.mat_out = passthrough(sIn, H_in);
    return;
  }

  const s = ctx?.scratch ?? {};
  const W_avail = s.hubAllocated_W ?? sElec.actual ?? 0;
  const W_actual = Math.min(Q_duty, W_avail);
  const H_out = H_in + W_actual;

  ports.mat_out = {
    type: StreamType.MATERIAL, P: sIn.P, n: { ...sIn.n },
    phaseConstraint: 'VL', H_target_Jps: H_out
  };

  u.last = {
    T_in_K: sIn.T, T_setpoint_K: T_set,
    Q_duty_W: Q_duty, W_actual_W: W_actual,
    curtailed: W_actual < Q_duty - 1, eta: 1.0,
  };
}
```

### air_cooler — Fin-Fan Air Cooler (NEW, replaces cooler)

**Physical equipment:** Finned coil with electric fan blowing
ambient air across fins. Like a Kelvion or Alfa Laval air-cooled
exchanger. ~2 m² fin area for S-size.

```
Ports: mat_in (MATERIAL) → mat_out (MATERIAL)
Category: HEAT_EXCHANGER
Params: T_out (K, default 303.15 = 30°C), T_approach (K, default 10)
cheat: false (was true on old cooler!)
```

**2nd-Law Constraint:**
```
T_floor = SimSettings.atmosphere.T_K + par.T_approach
T_out_actual = max(T_floor, par.T_out)
```

The atmosphere temperature is a visible global parameter the player
chose (Planet X = 288K, Mars = 210K, Venus = 737K). The approach
captures finite equipment UA. Together they enforce the 2nd law:
you cannot cool below ambient without a refrigeration cycle.

**Behavior:**
- If par.T_out < T_floor → clamp + WARNING explaining the floor
- If par.T_out > T_in → ERROR "Air cooler cannot heat"
- Q_removed = H_in − H_out → diagnostic in u.last, NOT a stream
- No heat port. The atmosphere absorbs the heat. A pilot-plant
  fin-fan disperses to ambient air — infinite heat sink relative
  to plant scale.

**Tick sketch:**
```js
tick(u, ports, par) {
  const sIn = ports.mat_in;
  if (!sIn) return;

  const H_in = thermo.getHdot_Jps(sIn);
  const T_amb = SimSettings.atmosphere.T_K;
  const approach = par.T_approach ?? 10;
  const T_floor = T_amb + approach;

  let T_set = par.T_out ?? T_floor;
  let clamped = false;

  if (T_set < T_floor) { T_set = T_floor; clamped = true; }

  if (T_set > sIn.T + 0.01) {
    u.last = { error: MAJOR('Air cooler cannot heat') };
    ports.mat_out = passthrough(sIn, H_in);
    return;
  }

  const H_out = thermo.getHdot_Jps(
    { T: T_set, P: sIn.P, n: sIn.n, phaseConstraint: 'VL' });

  ports.mat_out = {
    type: StreamType.MATERIAL, P: sIn.P, n: { ...sIn.n },
    phaseConstraint: 'VL', H_target_Jps: H_out
  };

  u.last = {
    T_in_K: sIn.T, T_out_K: T_set, T_setpoint_K: par.T_out,
    T_ambient_K: T_amb, T_approach_K: approach, T_floor_K: T_floor,
    Q_removed_W: H_in - H_out, clamped,
  };

  if (clamped) {
    u.last.error = {
      severity: ErrorSeverity.WARNING,
      message: `Cannot cool below ${(T_floor-273.15).toFixed(0)}°C `
        + `(ambient ${(T_amb-273.15).toFixed(0)}°C `
        + `+ ${approach.toFixed(0)}K approach)`
    };
  }
}
```

### reactor_equilibrium — Electrical Jacket (MODIFIED)

**Physical equipment:** Fixed-bed reactor with PID-controlled
electrical resistance jacket. Standard from Parr, Büchi, etc.
The jacket adds heat regardless of reaction direction.

```
Old ports: mat_in (MAT), heat_in (HEAT), mat_out (MAT)
New ports: mat_in (MAT), elec_in (ELEC), mat_out (MAT)
```

**Heated mode behavior:**
- Draws Q from elec_in via hub allocation
- CSTR solver: H(T_out, n_eq) = H_in + Q_in
- Endothermic reaction (SMR): Q_in sustains reaction + raises T
- Exothermic reaction (Sabatier): Q_in adds ON TOP of exotherm.
  T_out is higher than adiabatic case. WYSIWYG: you connected
  power, you get more heat. No special casing. The existing
  solver handles this correctly — it just solves for T_out.

**Insulated mode:** elec_in port hidden (presentation variant).
Q_in = 0. Purely adiabatic.

**Changes in tick (~5 lines):**
```js
// Old:
let Q_in_W = 0;
if (mode === 'heated') {
  Q_in_W = ports.heat_in?.actual ?? 0;
}

// New:
let Q_in_W = 0;
if (mode === 'heated') {
  const sElec = ports.elec_in;
  const s = ctx?.scratch ?? {};
  Q_in_W = s.hubAllocated_W ?? sElec?.actual ?? 0;
  u.powerDemand = Q_in_W;  // report to hub
}
```

Presentation variants:
```js
presentations: {
  'box/default':   { ports: { mat_in, mat_out, elec_in } },
  'box/insulated': { ports: { mat_in, mat_out } },
}
```

---

## Units Retired

| Unit | Reason | Replacement |
|------|--------|-------------|
| electric_heater | Absorbed into new heater | heater (elec_in) |
| sink_heat | No heat streams to sink | (deleted) |
| cooler | 2nd-law violation, cheat | air_cooler |

---

## StreamType.HEAT Removal

**Phase A (v11.3.0):** Remove all heat stream producers/consumers.
Leave StreamType.HEAT in enum — dead code, harmless.

**Phase B (v11.4.0):** Remove from enum, STREAM_CONTRACTS,
validation, connection drawing, solver propagation. Clean sweep.

---

## NNG-3 Update

Add physical-equipment clause:

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

---

## Demo Scene Impact

Current connections involving heat:
```
e-heat (electric_heater) → heat_out → e-q (sink_heat)   DELETE
cool (cooler) → heat_out → q-dump (sink_heat)            DELETE
hub → elec_out → e-heat (for electric_heater)             REWIRE
```

New:
```
hub → elec_out → heater.elec_in  (if heated reactor needed)
cool → air_cooler (no heat port, no q-dump)
```

Net: 3 fewer units (electric_heater, sink_heat ×2), 4 fewer
connections. Simpler flowsheet.

---

## Import Migration

```js
// Scene migration function (increment format version):

// 1. cooler → air_cooler
//    - Change defId from 'cooler' to 'air_cooler'
//    - Add T_approach: 10 if not in params
//    - Clamp T_out if below SimSettings.atmosphere.T_K + 10

// 2. electric_heater + heater combos → single heater
//    - Find pattern: X.elec_in ← source, X.heat_out → Y.heat_in
//      where X = electric_heater, Y = heater
//    - Delete X (electric_heater unit)
//    - Rewire: Y.elec_in ← X's former elec_in source
//    - Y keeps its mat_in and mat_out connections
//    - Y.params.T_out preserved (heater already had it implicitly
//      via T_out consequence)

// 3. sink_heat → delete unit + all connections to it

// 4. reactor_equilibrium heated mode
//    - Strip heat_in connections
//    - If former heat source was electric_heater:
//      wire reactor.elec_in to the hub that fed the e-heater

// 5. Delete orphaned units with zero connections
```

---

## Test Impact

### Tests needing rewrite (~15 test setups)

| Test area | Count | Nature of change |
|-----------|-------|-----------------|
| Heater energy balance | ~5 | e-heater+heater → single heater |
| Hub allocation to e-heater | ~4 | Hub → heater.elec_in directly |
| Cooler + sink_heat | ~2 | cooler → air_cooler, no sink |
| Reactor heated mode | ~2 | heat_in → elec_in |
| Hub surplus routing via sink_heat | ~2 | Use sink_electrical |

Each rewrite: ~2-5 lines changed per test. Mechanical.

### New tests

| Test | Validates |
|------|-----------|
| T_NEW_AC1 | Air cooler clamps at T_ambient + approach (Planet X) |
| T_NEW_AC2 | Air cooler on Mars (210K) → different floor |
| T_NEW_AC3 | Air cooler T_out > T_in → error, passthrough |
| T_NEW_H1 | Heater curtailment (50% power → partial heating) |
| T_NEW_H2 | Heater no elec → passthrough + error |
| T_NEW_H3 | Heater T_out < T_in → warning + passthrough |
| T_NEW_R1 | Reactor heated mode exothermic: Q_in adds to exotherm |
| T_NEW_R2 | Reactor heated mode endothermic: Q_in sustains reaction |

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Heater rewrite | Low | Same physics (H_in + Q = H_out), different Q source |
| Air cooler | Low | Simpler than cooler (no heat port, add floor) |
| Reactor elec port | Low | ~5 lines in tick, solver unchanged |
| Import migration | Medium | Pattern matching for combos; test thoroughly |
| Test rewrites | Low | Mechanical, ~2-5 lines each |
| Dead HEAT code | None | Left in place Phase A, removed Phase B |

---

## Implementation Sequence

```
Step 1: Register air_cooler (new unit)
Step 2: Rewrite heater tick + ports
Step 3: Update reactor_equilibrium ports + tick
Step 4: Delete electric_heater, sink_heat from registry
Step 5: Update demo scene
Step 6: Write import migration
Step 7: Rewrite affected tests (~15)
Step 8: Write new tests (~8)
Step 9: Update NNG-3 (physical-equipment clause)
Step 10: Verify: grep StreamType.HEAT producers → zero
```

Estimated: ~200 lines changed, ~50 lines net reduction.
