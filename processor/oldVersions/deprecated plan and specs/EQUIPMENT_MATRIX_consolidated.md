# processThis — Consolidated Equipment & Chemistry Matrix
## Reconciling Game Architecture v1.0 with Engine Specs
### February 2026

The game architecture documents (Parts I–IV, VII–VIII) supersede
`processThis-game-spec-v2.md` for game design intent. The engine
specs (S1–S7) remain authoritative for implementation detail.
This document reconciles the two views.

**Game design status: SKETCH with deliberate uncertainty.**
This consolidation flags conflicts and open questions without
forcing premature resolution.

---

## 1. Equipment Reconciliation

### Master Equipment Table

```
GAME NAME              ENGINE defId              MISSION   ENGINE STAGE   NOTES
─────────────────────  ────────────────────────  ───────   ────────────   ─────────────────────
Air Cooler             air_cooler                M1        baseline       ✓ aligned
Flash Drum             flash_drum                M1        baseline       ✓ aligned
Tank                   tank                      M1        baseline       ⚠ limit conflict (see §2)
Electrolyzer           reactor_electrochemical   M2        S6             ⚠ mapping question (see §3)
Mixer                  mixer                     M3        baseline       ✓ aligned
Reactor (equilibrium)  reactor_equilibrium       M3        baseline       ✓ aligned
HEX                    hex                       M3        baseline       ✓ aligned
Compressor             compressor                M4        baseline       ✓ aligned
Gas Turbine            gas_turbine               M4        baseline       ✓ aligned
Reactor (adiabatic)    reactor_equilibrium       M4        baseline       ⚠ variant question (see §4)
Valve                  valve                     M5        baseline       ✓ aligned
Splitter               splitter                  M7        baseline       ✓ aligned
Heater                 electric_heater           M7        baseline       ✓ aligned (name differs)
Pump                   pump                      M8        baseline       ✓ aligned
Greenhouse             (composite, new)          M10       S8             Game-only composite unit
Human                  (composite, new)          M10       S8             Game-only composite unit
Dewar Tank             tank (variant)            M9        S1 or S8       ⚠ variant question (see §5)
─────────────────────  ────────────────────────  ───────   ────────────   ─────────────────────
Battery                battery                   M2        baseline       ✓ infrastructure
Power Hub              power_hub                 M4        baseline       ✓ infrastructure
Source (vent)          source / source_multi     M1        baseline       Game flavor on existing unit
Source (atmosphere)    source_air                M4        baseline       Game flavor on existing unit
```

### Units NOT in Game Campaign

These engine units exist (or are planned) but no campaign mission
uses them. They remain available in sandbox mode.

| Engine Unit | Engine Stage | Why Not in Campaign |
|-------------|-------------|---------------------|
| distillation_column | S4 | M5 uses compression+flash for air separation, not distillation |
| reservoir | S5 | Replaces source in engine; game uses source with narrative flavor |
| source, source_multi | baseline | Game reframes these as "vent" and "atmosphere" |
| source_air | baseline | Game reframes as atmosphere source |
| sink | baseline | Implicit in game (room exhaust, waste streams) |
| sink_electrical | baseline | Implicit in game (surplus power absorption) |
| grid_supply | baseline | Not needed (no grid on alien planet) |

### Phantom Units (Confirmed Dead)

These appeared in the old game spec (v2) but do NOT exist in
code or in the new game architecture:

    sink_heat, cooler, generator, source_mechanical, motor

The new game architecture does not reference any of these.
Confirmed eliminated.

---

## 2. Tank Pressure Limit Conflict

**Game architecture (Part VII §45.3):**
  Tank max pressure: 200 bar. Volume 0.15 m³ default.

**Equipment limits spec (final_equipment_limits_S.md):**
  Tank P_HH: 5 bar (500,000 Pa). LP design, PN6 rating.

**These are incompatible.** A PN6 vessel at 200 bar is physically
impossible. The limits spec models a low-pressure storage tank
(atmospheric buffer, water holding). The game architecture imagines
a general-purpose pressure vessel.

### Resolution Options

**Option A — Two tank variants:**
- `tank` (LP): P_HH = 5 bar. The M1 water collection tank.
- `tank_hp` or `vessel`: P_HH = 150 bar. For gas storage, HP service.
- Dewar tank: P_HH = 10 bar, T_LL = 20 K. Cryo variant for M9.

**Option B — Single tank, pressure unlocked:**
- Remove the 5 bar limit. Set P_HH = 150 bar (harmonized).
- This makes "tank" a universal vessel but loses the realistic
  LP/HP distinction that teaches real equipment limitations.

**Option C — Tank pressure set by context:**
- Mission paramLocks set the effective P limit per mission.
- Engine limits are the physical maximum (150 bar).
- The LP teaching moment comes from M1 narrative, not code limits.

**Recommendation:** Option A is the most physically realistic and
creates a genuine game constraint (LP vs HP vessels). But it adds
a unit type. Option C is simplest for the engine. **Decision
deferred — game design uncertainty acknowledged.**

---

## 3. Electrolyzer → reactor_electrochemical Mapping

**Game architecture:** The electrolyzer is a dedicated unit with
specific PEM specs (1.8V cell voltage, up to 1 kW, 5.18 mol/hr
O₂). Introduced in M2. Three outlet ports (O₂, H₂, liquid_in).

**Engine spec (S6):** `reactor_electrochemical` is a generic
power-driven reactor with one material inlet, one material outlet,
and a power inlet. Reaction selected by parameter (R_H2O_ELEC,
R_CO2_ELEC, etc.).

### Conflict: Port Layout

The game electrolyzer has **separate O₂ and H₂ outlet ports.**
The engine reactor_electrochemical has **one combined mat_out.**

This is significant for gameplay: the player needs to route O₂
and H₂ to different destinations. A single mat_out would require
a downstream flash drum or splitter to separate them — which is
physically wrong (PEM cells produce pure streams from separate
electrodes).

### Resolution Options

**Option A — Dedicated electrolyzer unit:**
Register `electrolyzer` as a separate defId with 2 material
outlets (gas_out_O2, gas_out_H2). Internal physics uses the
same electrochemical math. reactor_electrochemical stays generic.

**Option B — Multi-port reactor_electrochemical:**
Add a second mat_out port. When reaction products include
species with no common liquid/gas phase, route to separate ports.
Complex, generic, possibly over-engineered.

**Option C — Game uses reactor_electrochemical + flash drum:**
The player adds a flash drum downstream to separate H₂ and O₂.
Physically wrong (PEM doesn't mix products) but gameplay works.

**Recommendation:** Option A. The electrolyzer is physically
distinct from a generic electrochemical reactor (separate
electrode chambers vs single reaction vessel). A dedicated
unit is more honest and teaches the right lesson. The generic
reactor_electrochemical can handle CO₂ electrolysis (single
mixed output) while the electrolyzer handles water splitting
(dual pure outputs). **Decision deferred per game sketch status.**

---

## 4. Reactor (Adiabatic) — Variant vs Separate Unit

**Game architecture:** Lists `reactor_adi` and `reactor_eq` as
separate equipment types with different visual signatures and
different salvage origins. reactor_adi is a "combustion chamber"
from the propulsion section (M4). reactor_eq is a "catalytic bed"
from the Sabatier recycler (M3).

**Engine code:** `reactor_adiabatic` was deleted in v12.0.0.
`reactor_equilibrium` with `heatDemand: 'none'` IS adiabatic mode.

### The Real Question

Is the game's "adiabatic reactor" a different physical object
or the same physics with different presentation?

**Physically:** Both are fixed-bed reactors. A combustion chamber
with catalyst is just a reactor running an exothermic reaction
adiabatically. The physics is identical.

**Visually:** The game wants different 3D models (catalytic bed
with insulation wrap vs combustion chamber with flame viewport).

### Resolution Options

**Option A — Visual variants of one defId:**
reactor_equilibrium gets a `visualVariant` parameter ('catalytic',
'combustion') that changes the 3D model but not the physics.
Mission paramLocks can fix which variant is appropriate.

**Option B — Reintroduce reactor_adiabatic as alias:**
Register `reactor_adiabatic` as a thin wrapper that delegates
to reactor_equilibrium with heatDemand locked to 'none'. Gives
the game a separate defId for palettes and visuals.

**Recommendation:** Option A. One physics, multiple presentations.
The `visualVariant` pattern will be needed for other units too
(e.g. Dewar tank vs standard tank). Avoids proliferating defIds
that share identical physics. **But game design may override.**

---

## 5. Tank Variants (Standard, HP, Dewar)

The game progression implies three tank roles:

| Role | Mission | T range | P range | Notes |
|------|---------|---------|---------|-------|
| Water/buffer | M1 | 263–353 K | 0.8–5 bar | LP, PN6 |
| Gas storage | M3+ | 243–353 K | 1–150 bar | HP, gas service |
| Cryo Dewar | M9 | 20–353 K | 0.5–10 bar | Vacuum-insulated |

Whether these are separate defIds, variants of one defId, or
distinguished only by mission paramLocks is an open question.

---

## 6. Chemistry Reconciliation

### Reactions: Game vs Engine

| Game Reaction | Engine ID | Game Mission | Engine Stage |
|---------------|-----------|-------------|-------------|
| R_WATER_SPLIT | R_H2O_ELEC | M2 | S1 (data) / S6 (unit) |
| R_SABATIER | R_SABATIER | M3 | baseline |
| R_CH4_COMB | R_CH4_COMB | M4 | S1 |
| R_HABER | R_HABER | M7 | S1 |
| R_PHOTOSYNTHESIS | (new) | M10 | S8 |
| R_METABOLISM | (new) | M10 | S8 |

### Engine Reactions NOT Used by Campaign

| Engine ID | Stage | Available In |
|-----------|-------|-------------|
| R_H2_COMB | baseline | Sandbox |
| R_SMR_OVERALL | baseline (renamed) | Sandbox |
| R_SMR | S1 | Sandbox |
| R_WGS | S1 | Sandbox |
| R_RWGS | S1 | Sandbox |
| R_CO2_ELEC | S1 (data) / S6 | Sandbox |

The campaign uses only 6 reactions. The engine registers 13
(11 from S1 + 2 game composites). The extras enable sandbox
experimentation (syngas chemistry, reverse water-gas shift, etc.)

### Species: Game vs Engine

| Species | Game Mission | Engine Stage |
|---------|-------------|-------------|
| H₂O | M1 (vent) | baseline |
| CO₂ | M1 (vent) | baseline |
| N₂ | M1 (vent) | baseline |
| CH₄ | M1 (vent) | baseline |
| Ar | M1 (vent, trace) | baseline |
| H₂ | M2 (electrolysis) | baseline |
| O₂ | M2 (electrolysis) | baseline |
| NH₃ | M7 (Haber) | baseline |
| CO | (not in campaign) | S1 |
| He | (not in campaign) | baseline |
| CH₂O | M10 (food proxy) | S8 |

The game introduces CH₂O (formaldehyde as food proxy) in M10.
This needs ComponentRegistry registration in S8 (or earlier if
engine completeness is desired).

---

## 7. Impact on Session Plan

The game architecture documents **do not change the engine
session plan** (S1–S7). All engine work remains valid and
necessary for sandbox mode and future chapters.

Changes to S8 sessions:

| Item | Previous Assumption | Game Arch Reality |
|------|--------------------|--------------------|
| Unit inventory | 20+3 units | 20 base + electrolyzer question + composites |
| Distillation column | Used in campaign | NOT used in campaign (sandbox only) |
| Source deprecation | Replaced by reservoir | Sources remain as "vent" in campaign |
| reactor_adiabatic | Dead | Revived as visual variant for combustion |
| Tank variants | One type | LP/HP/Dewar split needed |
| M10 chemistry | Unspecified | CH₂O + R_PHOTOSYNTHESIS + R_METABOLISM |
| Time/failure model | sim/prod state machine | Build/Run with checkpoint (simpler) |

The biggest S8 simplification: the game architecture uses a
**Build/Run checkpoint model** (Kerbal-style), NOT the
sim/prod dual-scene state machine from the old game spec.
This is architecturally simpler — one scene with checkpointing,
not two independent scenes.

---

## 8. Open Design Questions (Flagged, Not Resolved)

These require Denis's decision. They don't block engine work (S1–S7).

1. **Tank variants:** LP/HP/Dewar as separate defIds or one unit?
2. **Electrolyzer:** Dedicated unit (2 outlets) or generic reactor?
3. **Reactor visual variants:** Combustion vs catalytic presentation?
4. **M10 power:** 82 kW grow lights — multiple Brayton units, solar
   array, or tunable LED efficiency parameter?
5. **Distillation column:** Still worth building for sandbox/Ch.2,
   even though campaign doesn't use it?
6. **R_STEAM_REFORM fate:** Keep as R_SMR_OVERALL alongside R_SMR?
   (Game doesn't use either — purely sandbox/Ch.2)
7. **CH₂O registration:** In S8 with M10, or in S1 for completeness?

---

## 9. Corrected Equipment Count

| Context | Unit Types | Notes |
|---------|-----------|-------|
| Current code (v12.10.0) | 20 | Including infrastructure |
| After engine stages (S1–S7) | 22–24 | +distillation_column, +reservoir, +reactor_electrochemical (or +electrolyzer) |
| Game campaign needs | 16 process + 2 composites | 14 base process + electrolyzer + Dewar (variant) + greenhouse + human |
| Sandbox (all unlocked) | 22–24 + 2 composites | Everything |

---

## 10. Document Authority (Updated)

| Document | Role | Status |
|----------|------|--------|
| game_arch_part_1_to_3 | Game design: world, story, philosophy | **Supersedes** game-spec-v2 |
| game_arch_part_4_missions | Game design: mission details | **Supersedes** game-spec-v2 |
| game_arch_part_7_equipment | Game design: equipment list | **Supersedes** game-spec-v2 |
| game_arch_part_8_ux | Game design: UX, time model, UI | **Supersedes** game-spec-v2 |
| processThis-game-spec-v2.md | **RETIRED** | Superseded by above |
| SESSION_PLAN.md | Implementation sequencing | Authority for S1–S7; S8 needs update |
| AUDIT_specs_vs_code.md | Discrepancy record | Still valid; game spec errata now moot |
| SPEC_ERRATA.md | Corrections per spec file | Game spec entries now moot |
| Engine specs (S1–S7) | Implementation detail | Unchanged, still authoritative |
