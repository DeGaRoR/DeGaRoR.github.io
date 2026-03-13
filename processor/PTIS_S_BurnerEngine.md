# PTIS_S_BurnerEngine

## SimpleBurner

### Purpose
Generic multi-fuel combustion unit converting chemical energy into fluid enthalpy.

### Gameplay Role
- Basic heat source
- Fuel disposal
- Temperature increase of process streams
- Foundation unit for thermal systems

### Ports

**Inlets**
- ProcessGas (required)

**Outlets**
- ProcessGasOut (required)

### Supported Species (minimum)
O2, CH4, H2, H2O, CO2, N2

### Reactions (complete combustion set)
H2 + 0.5 O2 → H2O  
CH4 + 2 O2 → CO2 + 2 H2O

### Reaction Model
- Detect available fuels automatically
- Compute total O2 stoichiometric demand:
  
O2_req = 0.5*n_H2 + 2*n_CH4

- If O2 ≥ O2_req:
  complete combustion

- Else:
  proportional combustion factor:

f = O2_available / O2_req

extent_i = f * fuel_i

### Energy Model
All released chemical energy is transferred to outlet stream enthalpy.

Q_release = Σ(extent_i × LHV_i)

No separate heat port.

### Operating Limits

**Temperature**
- Inlet: 250 – 900 K
- Outlet: max 2200 K (above → damage / shutdown)

**Pressure**
- Operating range: 0.5 – 10 bar
- Recommended: 0.8 – 5 bar
- Above max → structural failure risk

**Flow (fuel power basis)**
- Minimum fuel power: 0.5 kW
- Nominal range: 1 – 50 kW
- Above 75 kW → overload state

### Simplifications
- Instant reaction
- Perfect mixing
- No CO formation
- No NOx
- No kinetics
- Optional fixed pressure drop

### Parameters
- allowedFuels
- heatLossFraction (optional)
- pressureDropMode

### UI Indicators
- Fuel flow
- O2 availability
- Combustion ratio
- Outlet temperature
- Heat release rate
- Status: Off / Burning / O2 limited / Fuel depleted / Overheat

---

## SmallGasEngineGenerator

### Purpose
Small fuel-flexible generator converting part of fuel chemical energy into electricity while leaving remaining energy in exhaust fluid.

### Gameplay Role
- Early / mid game electrical production
- Survival energy recovery
- Requires downstream thermal management

### Ports

**Inlets**
- FuelGas (required)
- Oxidant (optional if air implicit)

**Outlets**
- ExhaustGas (required)
- ElectricPower (virtual output)

### Combustion Model
Uses same combustion logic as SimpleBurner via shared CombustionCore.

### Energy Conversion Model

Chemical energy released:

Q_release

Electrical production:

P_electric = electricEfficiency × Q_release

Remaining energy transferred to exhaust:

Q_exhaust = Q_release − P_electric

### Operating Limits

**Temperature**
- Inlet fuel: 250 – 600 K
- Exhaust max: 1100 K
- Above limit → efficiency drop + failure risk

**Pressure**
- Operating range: 0.8 – 6 bar
- Optimal: 1 – 3 bar
- Below 0.7 bar → unstable combustion

**Fuel Power**
- Minimum stable: 2 kW
- Nominal: 5 – 40 kW
- Peak: 60 kW
- Above peak → trip condition

**Electric Output**
- Typical: 0.5 – 12 kWe
- Efficiency range: 15–35%

### Typical Parameter Ranges
electricEfficiency:
0.15 – 0.35 (default 0.25)

heatLossFraction (optional):
0 – 0.1

minFuelPowerForOperation:
threshold for stable running

### Simplifications
- No RPM model
- No torque model
- No mechanical subsystem
- No explicit cooling loop
- Mechanical conversion implicit
- Instant steady operation

### Parameters
- electricEfficiency
- allowedFuels
- oxidantMode (implicit_air | explicit_stream)
- minFuelPowerForOperation
- heatLossFraction

### Failure Conditions
- Insufficient fuel power
- Insufficient O2
- Unsupported fuel composition
- Below minimum operating load
- Overtemperature
- Overload

### UI Indicators
- Running state
- Fuel power input
- Electric output
- Exhaust temperature
- Exhaust flow
- Efficiency
- O2 status
- Load ratio

---

## Shared Internal Module

### CombustionCore

Common internal solver responsible for:
- Fuel detection
- Reaction selection
- Stoichiometric balancing
- O2 limitation handling
- Product generation
- Energy release calculation

Used by:
- SimpleBurner
- SmallGasEngineGenerator

### Design Principle
Units do not model individual reactions directly.
Units define allowed reactions.
CombustionCore solves reaction extents.

---

## Design Philosophy

Key modeling rule:

Chemical Energy → Electricity + Fluid Enthalpy

Heat is not exported as an abstract resource.
All non-electrical energy remains physically recoverable through downstream units.

This preserves:
- Energy conservation clarity
- Process realism
- Player-driven heat recovery design
