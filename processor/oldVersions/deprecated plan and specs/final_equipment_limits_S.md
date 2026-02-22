# Equipment Limits Database — Size S (Pilot Plant)
## Reference Document for v11.3.0 — FINAL

### Context

**Scale:** Pilot plant supporting 10-20 persons with S-size
equipment. All pieces movable by 2-4 persons. 50–200 L vessels,
DN15–DN50 piping, 0.5–5 kW electric motors.

**Construction:** SS316L wetted parts. FKM (Viton) seals on
rotating equipment. All-metal (graphite gaskets) on reactors
and high-T units. Standard flanged connections.

**Working fluids:** H₂, N₂, O₂, Ar, He, CH₄, CO₂, H₂O, NH₃.

**Compressor type:** Diaphragm (Hofer/Haskel/PDC style). 50-150 kg.
High pressure capability (200+ bar rated), modest flow. Standard
pilot-plant equipment for gas compression at elevated pressures.

### Conventions
- LL/HH = equipment destruction (manufacturer hard stop)
- L/H = operational warning (~70-80% of LL/HH, per ISA-18.2)
- "—" = no limit on that side
- All SI values: T in K, P in Pa, mass in kg/s

---

### Mission Compatibility Matrix

All 10 narrative-trunk missions supported by S-size equipment.

| Mission | Key Duty | Critical Param | Value | Limit | Margin |
|---------|----------|----------------|-------|-------|--------|
| M1 Water | Cool vent gas | T_in cooler | 500K | 723K | 44% |
| M3 Fuel | Sabatier rxn | T reactor | ~550K | 923K | OK |
| M4 Power | Turbine TIT | T_in turbine | ~900K | 1023K | 14% |
| M5 Air | Compress CO₂ | P compressor | ~65bar | 150bar | 57% |
| M5 Air | Intercool | T_out cooler | 298K | floor | exact |
| M6 Refrig | Compress cycle | P compressor | ~60bar | 150bar | OK |
| M8 Haber | Compress syngas | P compressor | 100bar | 150bar | 33% |
| M8 Haber | Reactor | P reactor | 100bar | 150bar | 33% |
| M8 Haber | Condense NH₃ | T_floor cooler | ~353K | >298K | OK |
| M9 Scale | Rankine pump | P pump | 10bar | 50bar | OK |

---

### Per-Unit Limit Specifications

#### Compressor (S) — Diaphragm

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_in (°C) | −30 | −10 | 60 | 80 | FKM diaphragm limit |
| P_out (bar) | 0.5 | 1 | 120 | 150 | Diaphragm casing rating |
| mass (kg/s) | — | — | 0.03 | 0.05 | Stroke volume limit |
| phase | — | — | — | req: V | Liquid → diaphragm rupture |

#### Pump (S) — Metering/Gear

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_in (°C) | −10 | 5 | 80 | 120 | FKM seal limit |
| P_out (bar) | 0.5 | 1 | 40 | 50 | Casing/seal rating |
| mass (kg/s) | — | — | 0.08 | 0.12 | Motor torque |
| phase | — | — | — | req: L | Vapor → cavitation |

#### Gas Turbine (S) — Micro Radial Expander

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_in (°C) | 50 | 100 | 600 | 750 | Inconel 625 continuous |
| P_in (bar) | 1.5 | 2 | 120 | 150 | Casing matched to compressor |
| mass (kg/s) | 0.005 | 0.01 | 0.08 | 0.12 | Bearing / min stable |
| phase | — | — | — | req: V | Liquid → blade erosion |

#### Heater (S) — Inline Electric Process Heater

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_out (°C) | −20 | 0 | 450 | 550 | SS316L creep / element sheath |
| P (bar) | 0.2 | 0.5 | 120 | 150 | Housing matched to system |
| mass (kg/s) | 0.002 | 0.005 | 0.08 | 0.12 | Burnout / capacity |

#### Air Cooler (S) — Fin-Fan

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_in (°C) | −20 | 0 | 350 | 450 | SS coil + brazed fin joints |
| P (bar) | 0.2 | 0.5 | 120 | 150 | Coil tubing rating |
| mass (kg/s) | — | — | 0.08 | 0.12 | Tube velocity / erosion |

Additional tick constraint: T_out ≥ T_ambient + T_approach

#### Heat Exchanger (S) — Plate or Coil-in-Shell

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T (°C) | −30 | −10 | 300 | 400 | Brazed plate; cryogenic use |
| P (bar) | 0.2 | 0.5 | 120 | 150 | Plate/tube rating for HP |
| mass (kg/s) | — | — | 0.08 | 0.12 | Per-side channel velocity |

#### Valve (S) — Globe/Ball Control Valve

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T (°C) | −30 | −10 | 250 | 350 | FKM packing; cryo variant |
| P_in (bar) | — | — | 120 | 150 | Body rating matched to system |
| mass (kg/s) | — | — | 0.15 | 0.25 | Cv capacity / choked flow |

#### Flash Drum (S) — Vertical with Demister

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T (°C) | −30 | −10 | 250 | 350 | Vessel + nozzle seals |
| P (bar) | 0.2 | 0.5 | 120 | 150 | ASME VIII vessel |
| mass (kg/s) | — | — | 0.08 | 0.15 | Demister flooding |

#### Mixer (S) — Static Mixer / Tee

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T (°C) | −30 | −10 | 350 | 450 | SS316L pipe + welds |
| P (bar) | 0.2 | 0.5 | 120 | 150 | Pipe schedule rating |
| mass (kg/s) | — | — | 0.15 | 0.25 | Pipe velocity |

#### Splitter (S) — Tee-Piece

Same limits as mixer.

#### Reactor — Adiabatic (S) — Fixed-Bed Tubular

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T_in (°C) | 50 | 100 | 500 | 650 | SS316L + ceramic internals |
| P (bar) | 0.5 | 1 | 120 | 150 | HP vessel for Haber service |
| mass (kg/s) | 0.001 | 0.005 | 0.05 | 0.08 | Min stable / max ΔP |
| phase | — | — | — | req: V | Catalyst flooding |

#### Reactor — Equilibrium (S) — Fixed-Bed + Elec. Jacket

Same limits as adiabatic. Heated mode: elec_in port.

#### Tank (S) — Low-Pressure Storage

| Param | LL | L | H | HH | Rationale |
|-------|---:|--:|--:|---:|-----------|
| T (°C) | −10 | 5 | 60 | 80 | Atmospheric; nozzle stress |
| P (bar) | 0.8 | 0.9 | 3 | 5 | LP design PN6 |
| mass_in (kg/s) | — | — | 0.03 | 0.05 | Inlet nozzle velocity |
| level_pct | — | — | 90 | 100 | Overflow / rupture |

---

### Summary Table (SI — for direct code use)

```
Unit              T_LL  T_L   T_H   T_HH   P_LL    P_L      P_H        P_HH       m_LL   m_L    m_H   m_HH  phase  other
────────────────  ────  ────  ────  ─────  ──────  ───────  ─────────  ──────────  ─────  ─────  ────  ────  ─────  ─────
compressor         243   263   333    353   50000   100000  12000000   15000000     —      —     0.03  0.05  V
pump               263   278   353    393   50000   100000   4000000    5000000     —      —     0.08  0.12  L
gas_turbine        323   373   873   1023  150000   200000  12000000   15000000    0.005  0.01   0.08  0.12  V
heater             253   273   723    823   20000    50000  12000000   15000000    0.002  0.005  0.08  0.12
air_cooler         253   273   623    723   20000    50000  12000000   15000000     —      —     0.08  0.12
hex                243   263   573    673   20000    50000  12000000   15000000     —      —     0.08  0.12
valve              243   263   523    623      —        —   12000000   15000000     —      —     0.15  0.25
flash_drum         243   263   523    623   20000    50000  12000000   15000000     —      —     0.08  0.15
mixer              243   263   623    723   20000    50000  12000000   15000000     —      —     0.15  0.25
splitter           243   263   623    723   20000    50000  12000000   15000000     —      —     0.15  0.25
reactor_adiabatic  323   373   773    923   50000   100000  12000000   15000000    0.001  0.005  0.05  0.08  V
reactor_equilib.   323   373   773    923   50000   100000  12000000   15000000    0.001  0.005  0.05  0.08  V
tank               263   278   333    353   80000    90000    300000     500000     —      —     0.03  0.05        lvl H:90 HH:100
```

---

### Design Notes

1. **Pressure harmonized at 150 bar** across process system.
   Diaphragm compressor sets the ceiling. All piping, vessels,
   valves, HEX rated to match. Tank is the exception (PN6).

2. **Temperature ranges lowered to −30°C** on passive equipment
   for cryogenic refrigeration duties (M6/M7).

3. **Three units have mass LL** (minimum stable flow):
   heater (burnout), gas_turbine (surge), reactors (maldist.).

4. **Phase constraints** are binary CRITICAL.

5. **L/H set at ~70-80% of LL/HH** per ISA-18.2 practice.

---

### Default Parameter Updates (included in Phase 2)

| Unit | Param | Current | Proposed | Reason |
|------|-------|---------|----------|--------|
| tank | volume_m3 | 50 | 0.15 | 50 m³ industrial; 150L pilot |
| reactor_eq | volume_m3 | 1.0 | 0.003 | 1000L industrial; 3L pilot |
| air_cooler | T_out | (none) | 303.15 | 30°C, above floor |
| air_cooler | T_approach | (new) | 10 | 10K for S-size fin-fan |
| heater | T_out | 423.15 | 423.15 | Carried forward (150°C) |

---

### Haber Reaction (New Registration — Phase 2)

```js
ReactionRegistry.register('R_HABER', {
  name: 'Haber Synthesis',
  equation: 'N₂ + 3 H₂ ⇌ 2 NH₃',
  stoich: { N2: -1, H2: -3, NH3: 2 },
  reversible: true,
  Tmin_K: 400,
  Tmax_K: 900,
  Pmin_Pa: 100000,       // 1 bar
  Pmax_Pa: 30000000,     // 300 bar
  notes: 'Haber process. Fe or Ru catalyst. Equilibrium-limited '
    + '~15% per pass at 100 bar / 450°C. K crosses 1 near 463 K. '
    + 'High Ea means negligible conversion below ~400K.',
  references: [
    { source: 'NIST-JANAF', detail: 'Chase 1998, 4th ed.' }
  ],
  kinetics: {
    model: 'POWER_LAW',
    A: 8.85e14,
    beta: 0,
    Ea_Jmol: 170000,    // ~170 kJ/mol
    orders: { N2: 1, H2: 0.5 },
    references: [
      { source: 'Temkin-Pyzhev (adapted)',
        detail: 'Simplified power-law global fit for '
          + 'Fe catalyst. A/Ea adjusted for single-step '
          + 'equilibrium approach in CSTR model.' }
    ]
  }
});
```

Thermodynamic data:
  ΔH° = −91,796 J/mol  (exothermic)
  ΔS° = −198.11 J/(mol·K)
  Δν = −2  (4 gas moles → 2 gas moles)
  K > 1 below ~463K; high P strongly favors products (Le Chatelier)

NH₃ component already exists in ComponentRegistry with full
NIST data (added v10.x).
