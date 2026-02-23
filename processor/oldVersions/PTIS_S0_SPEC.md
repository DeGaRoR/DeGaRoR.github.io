# PTIS_S0_SPEC
## S0 — NNG Consolidation
### processThis v12.10.0 → v13.0.0

---

## Overview

**What:** Consolidate NNG rules from 17 to 15. Renumber for logical
ordering (physics → systems → architecture → UI → governance). Absorb
3 redundant rules into their parents. Extend 3 rules with principles
established during spec work. Add 1 new rule (pressure-flow network).
Update sentinel test. Update all codebase NNG references.

**Sessions:** 1

**Risk:** Low. Text-only changes to the header comment block, plus
sentinel test update. No functional code changes. No computed values
change.

**Dependencies:** None. S0 is the first stage.

**Required by:** Everything. S0 establishes the rules that gate all
subsequent implementation.

**After S0:** NNG-1 through NNG-15 canonical. All specs reference
the new numbering. Sentinel test validates NNG-1–NNG-15.

---

## Motivation

The current NNG-1 through NNG-17 grew organically over 40+ versions.
Three rules are redundant (NNG-8 is NNG-11's data format, NNG-10 is
NNG-7's quality bar, NNG-13 is NNG-12's test clause). Two new physics
constraints (pressure-flow algebra, power overload/curtailment) emerged
from spec work but have no NNG home. The numbering doesn't reflect
priority — architecture rules (NNG-4 through NNG-9) sit between
physics promises and data integrity, burying the solver protocol.

The consolidation orders rules from most fundamental (physics promises
to the player) to most operational (governance). A new developer reads
top-to-bottom and understands priorities: physics is non-negotiable,
everything else serves it.

---

## The 15 Rules

### PHYSICS — The Game's Promises

These are the contract with the player. They define what the
simulation world guarantees. Violating any of these breaks trust.

---

**NNG-1 — Conservation.**

Mass and energy are rigorously conserved. Every non-boundary unit:
mass-in = mass-out, energy-in = energy-out. Inventory units (tank,
battery) are exempt from the instantaneous check — their imbalance
is accumulation, tracked by the time-stepping layer. Reactors
include heat of reaction via formation enthalpies. No unit ever
creates or destroys mass or energy. Energy residuals > 100 W are
flagged.

*Status: unchanged from v12.10.0.*

---

**NNG-2 — Second law.**

Heat flows hot → cold. No unit or solver shortcut reverses this
without explicit work input. A heater without a heat source does
not heat. A cooler without a heat sink does not cool.

*Status: unchanged from v12.10.0.*

---

**NNG-3 — WYSIWYG.**

Physics = visual state. Unconnected port carries zero — no flow,
no heat, no power. Every unit computes consequences of what it
receives, not what it requests. If a wire doesn't exist on canvas,
it doesn't exist in the solver. No implicit connections, no phantom
sources.

Every unit in the palette corresponds to a nameable, purchasable
piece of physical equipment. Heat is not a fluid; there is no heat
stream type. Heating → inline electric heater (elec_in). Cooling →
air cooler (ambient rejection).

Every defId in UnitRegistry corresponds to a distinct physical
machine — one you could point at in a pilot plant. If two machines
share physics but differ in ports or computation branching, they
are separate defIds sharing a tick trunk. If they differ only in
ratings, they are the same defId with constraints tightened by
mission paramLocks. Physical boundaries that prevent mixing
(electrode membranes, phase separators) are modeled explicitly as
separate outlet ports — never post-processed by downstream units.

Groups are a canvas-level organizational concept. A group is a named
set of units and their internal connections, displayed as a single
collapsible box with boundary ports. The solver sees through groups —
it iterates individual units and unit-to-unit connections. Groups
never affect tick ordering, stream resolution, pressure propagation,
or any computed value. A scene with groups produces identical physics
to the same scene ungrouped.

*Status: extended. Paragraphs 1–2 unchanged from v12.7.0. Paragraph
3 (equipment identity + electrode separation) new in v13.0.0.
Paragraph 4 (groups as canvas-level concept) new in v13.8.0.*

---

**NNG-4 — Pressure-flow network.**

Flow through Cv restrictions is computed algebraically from anchor
pressures, path resistances, and ΔP budgets. The solver never
iterates between flow and pressure fields. Every topology computes
in bounded time with deterministic results.

All material flows ≥ 0 everywhere. Backflow conditions are detected,
zeroed, and alarmed — never computed. Implicit check valves on every
connection.

No silent clamping. Any flow forced to zero by the pressure network
— backflow, pressure conflict, empty vessel, zero-resistance path,
insufficient ΔP — produces a visible alarm stating the cause. The
player always knows why a connection carries no flow.

*Status: new in v13.0.0. Codifies the S5 pressure network design.
Paragraph 3 (no silent clamping) added for v13.1.0.*

---

**NNG-5 — Power lifecycle.**

Power is the only demand-driven system. Strict sequence: capacity
(tick) → demand (solver B–E) → actual (solver, ≤ capacity) →
curtailmentFactor (actual/demand). Consumers read input.actual,
never input.capacity.

Physics-fixed sources (gas turbine): output determined by fluid
state, non-throttleable. Grid sources: always demand-responsive
(load draws, source doesn't push). Surplus from physics-fixed
sources exits elec_surplus; unconnected surplus > 0 = CATASTROPHIC.
Bidirectional ports (battery): actual may be negative (charging).
Hub reads _maxDischarge_W / _maxCharge_W from port, writes
hubDischarge_W / hubCharge_W to scratch.

Every power consumer has finite rated capacity — no Infinity demand.
Overload (power delivered > rated capacity) and curtailment (power
delivered < demand) are distinct failure modes with distinct severity.
Overload escalates: WARNING → ERROR → CRITICAL (fry). Curtailment
degrades gracefully (reduced output, INFO alarm).

*Status: extended. Paragraphs 1–2 are old NNG-17, unchanged.
Paragraph 3 (finite demand, overload ≠ curtailment) new in v13.0.0.
Moved from ALARM & POWER to PHYSICS — power management is a game
promise, not an implementation detail.*

---

### SYSTEMS — How Physics Is Executed

These define the engine's internal contracts. They ensure the physics
promises are computed correctly. A developer working on the solver
must know these.

---

**NNG-6 — Solver protocol and stream contracts.**

Step ordering is fixed:
  tick → validateStreamFlows (heal) → validateMaterialPreFlash
  → flash loop (TP/PH) → port storage → validateUnitPorts
  (post-flash) → Steps B (demand) → C (hub: physics-fixed →
  responsive → battery) → D (direct) → convergence check.

Inter-iteration state through RuntimeContext.scratch() only — never
u._anything. Inter-timestep state on u.inventory, invisible to
solveScene(). PH-flash must yield finite T or CATASTROPHIC.

STREAM_CONTRACTS is the sole schema definition for all stream types.
Two-phase validation: pre-flash (tick output, spec-aware) then
post-flash (resolved, T must exist for material). Material spec
inferred from fields (H_target_Jps → PH-flash, T → fully
specified) — no explicit spec field. All validation references the
contracts object. No ad-hoc field checks.

*Status: merged. Paragraphs 1–2 are old NNG-11. Paragraph 3 is
old NNG-8 (stream contracts), absorbed because stream contracts
define the data format that the solver protocol validates.*

---

**NNG-7 — Alarm architecture.**

Frozen schema (id, category, severity, message, unitId, …). Frozen
severity taxonomy: CATASTROPHIC > ERROR > WARNING > INFO > OK, each
with numeric .level for programmatic comparison. AlarmSystem.evaluate()
is the sole alarm producer — no other code path creates, modifies,
or injects alarm objects. Sources are pluggable pure functions, zero
DOM access. Sources produce, renderers consume — never crossed.
Standardized format is the foundation for future condensation,
aggregation, and global diagnosis layers.

*Status: unchanged from v12.10.0. Renumbered from old NNG-16.*

---

### ARCHITECTURE — How Code Is Organized

These define code structure. They keep the codebase maintainable
and testable. A developer adding a new unit or thermo model must
know these.

---

**NNG-8 — SI internally.**

Calculation engine: Pa, K, mol/s, W, J/mol, J/(mol·K), kg/m³.
No exceptions. User-facing params (kW, bar, °C) convert at tick
boundary. Never inside core.

*Status: unchanged from v12.10.0. Renumbered from old NNG-4.*

---

**NNG-9 — Tick isolation.**

A tick function is a pure computation: inputs → outputs. It reads
only its own ports, params, and u.inventory. It never reads scene
state, other units' outputs, the DOM, or solver internals. It never
writes to u.inventory (only TimeClock does that between solves). It
never writes to scratch (that is solver-internal). If a tick needs
external context, it comes through a port.

*Status: unchanged from v12.10.0.*

---

**NNG-10 — Registries, adapters, and data integrity.**

Every extensible data domain has a static registry class
(register/get/all/exists): ComponentRegistry, ModelRegistry,
UnitRegistry, ReactionRegistry. All thermodynamic calculations
route through ThermoAdapter — tick functions never call
Antoine/Cp/flash/enthalpy directly. No ad-hoc unit implementations
outside UnitRegistry.register().

Every registry entry provides all required fields at registration
time — never at runtime. Species in ComponentRegistry need full
thermo data (MW, Tc, Pc, Tb, antoine, cpig) before any use.
Reactions reference only registered species, are mass-balanced
(Σνᵢ·MWᵢ = 0), and include a kinetics block with recognized model
and literature reference. Units declare limitParams and limits per
size at registration. No unit may produce an unregistered species.
Violations: CATASTROPHIC at startup.

GroupTemplateRegistry follows the same register/get/all/exists
pattern. Templates are frozen on registration. Template instantiation
creates real units and real connections — the template is a blueprint,
not a runtime abstraction.

*Status: merged. Paragraph 1 is old NNG-7. Paragraph 2 is old
NNG-10 (registry completeness), absorbed because data integrity
is the quality bar for registries — same concern, same rule.
Limits clause new in v13.0.0. Paragraph 3 (GroupTemplateRegistry)
new in v13.8.0.*

---

**NNG-11 — DOM-free core.**

Script block 1 contains zero references to document, window, or
any DOM API. Tests are headless against the core API only.
Everything tests or external code need is exported on PG.

*Status: unchanged from v12.10.0. Renumbered from old NNG-5.*

---

**NNG-12 — Single file.**

All code in one HTML file. No external JS, no build step. Only CDN
imports (icon fonts) permitted.

*Status: unchanged from v12.10.0. Renumbered from old NNG-6.*

---

### UI — How the Engine Is Presented

---

**NNG-13 — Inspector, presentation, and port labeling.**

Inspector section order is immutable:
  Params → Conditions → Flowrates → Composition → Reaction →
  Power & Energy → Sizing → KPIs → Detail.
Empty sections omitted entirely — never shown hollow. Port geometry
resolved exclusively through getPresentation() — never read
def.ports[].x/y directly. CSS-first styling via ins-* vocabulary.
One renderer per visual style (_renderKPIGrid,
_renderStreamConditions, _renderDetailSection).

Ports with special meaning (electrode outlets, hot/cold sides,
overflow, vent) carry a `label` field displayed in inspector
headers and connection tooltips. Absent label falls back to portId.

*Status: extended. Paragraph 1 is old NNG-15. Paragraph 2 (port
labeling) new in v13.0.0. Renumbered from old NNG-15.*

---

### GOVERNANCE — How We Keep It Honest

---

**NNG-14 — Development discipline.**

Every functional change increments version and adds a changelog
entry above the previous. Entry states: what changed, why, which
NNGs relevant, which tests added/modified. A refactor that would
change any computed value (T, P, power, flow) is not a refactor —
it is a functional change. Document and test it as one.

All existing tests pass after every change. No exceptions. New
features: minimum one positive-path + one edge-case test. All
tests deterministic: no random inputs, no timing dependencies.
Time tests use explicit TimeClock.step(), never real-time playback.
All time tests restore TimeClock and SimSettings to defaults after
completion.

*Status: merged. Paragraph 1 is old NNG-12. Paragraph 2 is old
NNG-13 (test discipline), absorbed because versioning and testing
are the same governance concern — how we manage change.*

---

**NNG-15 — XSS defense.**

Every user-editable string (u.name, err.message) must pass through
esc() before any innerHTML context. fmt.* outputs and def.* fields
from registries are trusted. No exceptions.

*Status: unchanged from v12.10.0. Renumbered from old NNG-14.*

---

## Renumbering Map

```
v13.0.0 NNG consolidation (17 → 15 rules):

NEW   OLD   CHANGE
───   ───   ──────
 1      1   unchanged
 2      2   unchanged
 3      3   extended: equipment identity, electrode separation
 4    NEW   Pressure-flow network (from S5 spec)
 5     17   extended: finite demand, overload ≠ curtailment. Moved to PHYSICS.
 6   11+8   merged: solver protocol + stream contracts
 7     16   unchanged, renumbered
 8      4   unchanged, renumbered
 9      9   unchanged
10   7+10   merged: registries + data integrity + limits
11      5   unchanged, renumbered
12      6   unchanged, renumbered
13     15   extended: port labels. Renumbered.
14  12+13   merged: version + test discipline
15     14   unchanged, renumbered

ABSORBED:
  Old NNG-8  (stream contracts)      → now part of new NNG-6
  Old NNG-10 (registry completeness) → now part of new NNG-10
  Old NNG-13 (test discipline)       → now part of new NNG-14
```

---

## Implementation

### Step 1: Replace NNG header block

Replace lines 13–155 of processThis.html (the entire NNG comment
block from `NNG-1 Conservation` through `NNG-17 Power lifecycle`)
with the 15 rules above, maintaining the same comment formatting
style (4-space indent, 72-char wrap, category headers).

### Step 2: Add changelog entry

```
v13.0.0 — NNG consolidation.
  17 rules → 15. Renumbered for physics-first ordering.
  Merges: NNG-8→6, NNG-10→10, NNG-13→14.
  Extensions: NNG-3 (equipment identity), NNG-5 (finite demand),
    NNG-13 (port labels).
  New: NNG-4 (pressure-flow network).
  See renumbering map in header.
  NNG: all. Tests: T302 updated.
```

### Step 3: Update sentinel test T302

```javascript
// Current:
const EXPECTED_NNGS = [
  'NNG-1','NNG-2','NNG-3','NNG-4','NNG-5','NNG-6','NNG-7','NNG-8',
  'NNG-9','NNG-10','NNG-11','NNG-12','NNG-13','NNG-14','NNG-15',
  'NNG-16','NNG-17'
];

// New:
const EXPECTED_NNGS = [
  'NNG-1','NNG-2','NNG-3','NNG-4','NNG-5','NNG-6','NNG-7','NNG-8',
  'NNG-9','NNG-10','NNG-11','NNG-12','NNG-13','NNG-14','NNG-15'
];
```

Sentinel searches for each string in the source text. All 15 appear
in the new header block. Old numbers (NNG-16, NNG-17) still appear
in historical changelog entries but are no longer in the sentinel
check.

### Step 4: Update in-code NNG references

Grep for all `NNG-\d+` references in code comments outside the
header and changelog. Update to new numbering:

```
Old reference    →  New reference
NNG-4 (SI)       →  NNG-8
NNG-5 (DOM-free) →  NNG-11
NNG-6 (single)   →  NNG-12
NNG-7 (registry) →  NNG-10
NNG-8 (stream)   →  NNG-6
NNG-9 (tick)     →  NNG-9 (unchanged)
NNG-10 (data)    →  NNG-10 (absorbed into same number)
NNG-11 (solver)  →  NNG-6
NNG-12 (version) →  NNG-14
NNG-13 (test)    →  NNG-14
NNG-14 (XSS)     →  NNG-15
NNG-15 (insp)    →  NNG-13
NNG-16 (alarm)   →  NNG-7
NNG-17 (power)   →  NNG-5
```

Legacy tags (NNG-W3, NNG-AL2, NNG-S5 etc.) in historical comments
are NOT updated — they predate even the old numbering and serve as
archaeological markers.

---

## Tests

| # | Test | Assert |
|---|------|--------|
| 1 | Sentinel: NNG-1 through NNG-15 in source | Every string found |
| 2 | No orphaned new-style references: no NNG-16, NNG-17 outside changelog | grep returns 0 matches in non-changelog code |

**Gate:** T302 updated. All existing tests pass (no functional changes).

---

## What S0 Does NOT Do

- No functional code changes. No computed values change.
- No spec document updates (those follow after S0 approval).
- No new physics, no new units, no new reactions.
- Pure documentation + sentinel test. One session. Low risk.

---

## After S0 Approval

Once S0 is committed, all subsequent specs (S1–S8) will reference
NNG-1 through NNG-15 exclusively. The S5_SPEC NNG-17/18 collision
will be fixed to reference NNG-4. Other spec docs will be updated
to use new numbering where NNGs are cited.
