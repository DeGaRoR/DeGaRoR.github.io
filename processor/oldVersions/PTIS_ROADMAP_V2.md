# PTIS_ROADMAP V2
## Process This In Space — Development Roadmap (Revised)
### Baseline: v13.7.0 (post-S4, 399 tests, 21 registered units, 10 species, 14 reactions)
### Strategy: Engine-first, vertical slice at Phase 1 (5 missions)

---

## Design Philosophy Change (February 2026)

The original roadmap treated S0–S9 as an engine-completion sprint
before any game layer work. The revised strategy **interleaves engine
and game work** to reach a playable vertical slice as early as
possible, then iterates.

Key structural changes:
- **S5-full replaced by S5-lite.** Pressure-driven flow with Cv
  equations and trace-based downstream pressure. No BFS zones, no
  full network solver. Deferred indefinitely — S5-lite provides the
  right balance of playability and physical realism.
- **S-SIM absorbs S10a.** The Kerbal-style play/pause/checkpoint
  system IS the game state machine. S10a no longer exists as a
  separate stage.
- **S-CLEAN inserted.** Port naming harmonization and source
  consolidation. Cheaper now than after more units are registered.
- **S-3D-0 early.** Standalone 3D POC (editor.html) run early to
  anchor port position design decisions before S6 registers 5 new
  reactor defIds.
- **Missions restructured.** Four narrative phases replacing the
  original A/B/C/D split. Phase 1 (5 missions) = vertical slice.
- **Purity mechanics added.** Room/shelter composition checks with
  health consequences. Buffer tanks decouple processes from life
  support.
- **S-TERRAFORM and S-3D** positioned as enhancement arcs, not
  blockers.

---

## Revised Mission Structure

### Phase 1 — SURVIVE (replace all countdowns except food)

| # | Mission | Player builds | Teaches | Engine gate |
|---|---------|--------------|---------|-------------|
| M1 | **Water** | Vent → cooler → flash → tank | Condensation, phase separation | S5-lite |
| M2 | **Oxygen** | Water → electrolyzer → O₂ to shelter | Electrolysis, electrical demand | S6 (electrochemicalTick) |
| M3 | **Fuel** | CO₂ + H₂ → Sabatier → CH₄ tank | Equilibrium reactions, recycle | Existing reactor |
| M4 | **Power** | CH₄ + compressor + turbine → electricity | Brayton cycle, energy balance | Existing equipment |
| M5 | **CO₂ Scrub (Boss)** | Integrate everything: scrub shelter air, close the loop | System integration | membrane_separator (cherry-pick from S9) |

Narrative arc: M1 "I can drink." → M2 "I can breathe." → M3 "I have
fuel." → M4 "POWER." → M5 "All life support loops closed except
food."

Population: 2 (Kael + Vasquez) through M3. +Jin at M4. 3 total for
Phase 1 Boss.

### Phase 2 — STABILIZE (food preservation, efficiency, expansion)

| # | Mission | Player builds | Teaches |
|---|---------|--------------|---------|
| M6 | **Cold Chain** | Refrigeration loop → food storage Dewar | Heat pump, COP, cryogenic storage |
| M7 | **Heat Integration** | Recover waste heat → Rankine bottom cycle | Combined cycle, pump work, efficiency |
| M8 | **Fertilizer** | Haber synthesis loop with recycle + purge | Inert accumulation, purge strategy |
| M9 | **Cryo Emergency** | Salvaged pharmaceuticals → deep-cold storage | Linde cycle, counterflow HEX, JT cooling |

Population: +Amara, Tomás at M6. +Priya, Erik at M8. 7 total.

### Phase 3 — SUSTAIN (biosphere)

| # | Mission | Player builds | Teaches |
|---|---------|--------------|---------|
| M10 | **Biosphere** | Greenhouse + human composites → closed loop for 7 | Ecosystem as process network, all chemistry is the same chemistry |

New vent discovered → second processing train → massive power demand
drives serious thermodynamic cycle design. S8 group templates enable
greenhouse and human as transparent, inspectable assemblies.

### Phase 4 — TERRAFORM (endgame, conceptual)

Blueprint-based scale-up. Atmospheric exchange accounting. The CO₂
removal puzzle (O₂ must stay at 21% — BECCS vs mineral carbonation).
Sky color changes. Temperature feedback. Victory = self-sustaining
biosphere.

Scope: S-TERRAFORM phases 2–4. Architecture designed but not yet
scheduled.

---

## Purity & Health Mechanics

The room/shelter is an atmospheric tank (50 m³). Buffer tanks between
processes and the shelter decouple chemistry from life support. Feed
composition matters — contamination has consequences.

### Air Quality Railguards

| Species | WARNING | MAJOR | CATASTROPHIC |
|---------|---------|-------|--------------|
| O₂ low | < 19.5% | < 16% (impaired) | < 14% (unconscious) |
| CO₂ high | > 1% | > 3% (narcosis) | > 5% (lethal) |
| CO | > 25 ppm | > 100 ppm (poison) | > 400 ppm |
| NH₃ | > 25 ppm | > 300 ppm | > 500 ppm |

### Water Quality Railguards

| Condition | WARNING | MAJOR |
|-----------|---------|-------|
| H₂O purity | < 98% | < 90% |
| NH₃ content | > 0.1% | > 1% |
| Any contaminant | > 0.5% | > 2% |

### Consequence Ladder

- **WARNING:** Vasquez comments. Gauges amber. No mechanical effect.
  Player has time to diagnose and fix.
- **MAJOR:** "Health declining" alarm. Crew efficiency drops (reduced
  metabolic rate → slower O₂ consumption, less work output). Countdown
  starts: X hours until CATASTROPHIC.
- **CATASTROPHIC:** Crew incapacitated → mission failure → revert to
  checkpoint.

Buffer tank dynamics: contamination builds gradually. A small CO leak
from incomplete combustion slowly poisons the shelter air. The player
notices gauges creeping and must diagnose the source — exactly how
real plant operators work.

Implementation: composition-based alarm sources on the room unit,
using existing AlarmSystem infrastructure (PLANT domain). No new
alarm architecture needed.

---

## Stages at a Glance

| # | Stage | Sessions | Risk | New Tests | Cumulative | Key Deliverable |
|---|-------|----------|------|-----------|------------|-----------------|
| — | ~~S0–S4~~ | ~~15~~ | — | — | 399 | ✅ Complete |
| 1 | S5-lite | 4 | Medium | ~49 | ~448 | Tank physics, Cv flow, pressure trace, reservoir, restriction |
| 2 | S-CLEAN | 2–3 | Low | 0 | ~448 | Port naming, source consolidation, distillation bar fix |
| — | S-3D-0 | 1 | Low | 0 | ~448 | 3D POC editor (standalone HTML), port position anchoring |
| 3 | S-SIM | 3 | Medium | ~12 | ~460 | Play/pause/checkpoint, catastrophic handling, absorbs S10a |
| 4 | S6 | 4 | Medium | ~16 | ~476 | 5 reactor defIds, HEAT purge, electrochemicalTick |
| 5 | S10b | 3–4 | Medium | ~12 | ~488 | Mission framework (schema, evaluators, stars, palette scarcity) |
| 6 | S10c-Ph1 | 3–4 | Medium | ~15 | ~503 | M1–M5 content, room, membrane_sep, depletables, purity checks |
| | | | | | | ⚡ **VERTICAL SLICE** ⚡ |
| 7 | S7 | 3–5 | Low | ~7 | ~510 | Performance maps, time-series recorder |
| 8 | S-3D | 3 | Medium | ~22 | ~532 | Three.js plant interface (foundation + pipes + polish) |
| 9 | S10c-Ph2 | 3–4 | Medium | ~8 | ~540 | M6–M9 content, tank_cryo, steam_turbine cherry-picks |
| 10 | S8 | 4 | Medium | ~18 | ~558 | GroupTemplateRegistry, overlay nav, scaling |
| 11 | S9 | 2 | Low | ~10 | ~568 | Full S9 registrations, CH₂O, R_PHOTOSYNTHESIS, R_METABOLISM |
| 12 | S9b | 3–5 | Low | 0 | ~568 | Validation gate (composite + mission mock-builds) |
| 13 | S10c-Ph3 | 3–4 | Medium | ~8 | ~576 | M10 biosphere, greenhouse + human composites |
| | | | | | | ⚙ **CAMPAIGN COMPLETE** ⚙ |
| 14 | S-TERRAFORM Ph.2–4 | 4–8 | Medium | ~15 | ~591 | Atmospheric exchange, dynamic atmosphere, endgame |
| | **Total** | **~46–56** | | **~192** | **~591** | |

### Session Budget

| Milestone | Cumulative Sessions | Test Count |
|-----------|-------------------|------------|
| Vertical Slice (5 missions) | ~20–22 | ~503 |
| Campaign Complete (10 missions) | ~40–48 | ~576 |
| Terraform Endgame | ~46–56 | ~591 |

---

## S5-lite — Tank Physics & Cv Flow

**What:** Replace the broken tank with physics-based vessels. Tanks
compute headspace P via `computeTankState()`. Flow through outlets
governed by Cv valve equations. Pre-tick pressure trace resolves
downstream pressures. New reservoir unit, restriction unit, enhanced
sink.

**Sessions:** 4 (S5a-0, S5a-1, S5a-2, S5a-3).

**Includes:** S-TERRAFORM Phase 1 (display-only: HUD atmospheric
dashboard, RH on presets, hardcoded 101325 defaults fixed). ~2 hours
embedded in S5a-0.

**Spec:** `PTIS_S5_LITE_SPEC.md`

---

## S-CLEAN — Codebase Cleanup

**What:** Port naming harmonization (10 units, ~360 touch points),
source consolidation (3 defIds → 1 with profiles), electrical
boundary port fix, distillation P_column_bar → Pa.

**Sessions:** 2–3. Mechanical refactor, regex-assisted.

**Why now:** S5-lite introduces new ports. S6 will register 5 new
defIds. Cleaning naming conventions NOW avoids accumulating more debt.
Every session delayed makes S-CLEAN more expensive.

**Spec:** `PTIS_S_CLEAN_SPEC.md`

---

## S-3D-0 — 3D POC (Editor Tool)

**What:** Standalone editor.html — Three.js canvas with orbit camera,
primitive generators, body composition tool, procedural materials,
port position editor, JSON export. Does NOT touch processThis.html.

**Sessions:** 1.

**Why now:** S6 registers 5 new reactor defIds with port layouts.
Seeing ports in 3D before committing those registrations avoids
rework. The editor tool also serves as proof-of-concept for the
procedural geometry approach (no imported models, no asset pipeline).

**Spec:** `PTIS_S_3D_SPEC.md` §15 (S-3D-0 only)

---

## S-SIM — Simulation Loop Redesign

**What:** Kill test mode. Two modes only: paused + playing. Checkpoint
system (auto on first play, periodic, pre-catastrophe). Restore
replaces Reset. Catastrophic modal (Restore / Continue with Damage).
u.fried flag. Auto-solve-on-edit while paused. Export v18.

**Sessions:** 3 (S-SIM-1 mode+checkpoint, S-SIM-2 catastrophic,
S-SIM-3 polish+export).

**Absorbs:** S10a (Build/Run state machine). What remains of S10a
after S-SIM is ~30 lines of time warp speed cycling, folded in here.

**Spec:** `PTIS_S_SIM_SPEC.md`

---

## S6 — Reactor Architecture

**What:** Split `reactor_equilibrium` into 3 thermal defIds
(adiabatic, jacketed, cooled). Revise `reactor_electrochemical`.
Revise `fuel_cell`. Purge HEAT port type. Two named trunk functions
(equilibriumTick, electrochemicalTick).

**Sessions:** 4 (S6a: 2 thermal, S6b: 2 electrochemical).

**Why full, not lite:** The thermal reactor variants (jacketed, cooled)
provide temperature limits that prevent burning out adiabatic reactors.
Without them, every high-temperature reaction (combustion, Sabatier
at high conversion) risks thermal runaway with no designed mitigation.
The formalization is modest — the hard physics work was done in S1–S3.

**Spec:** `PTIS_S6_SPEC.md`

---

## S10b — Mission Framework

**What:** MissionDefinition schema. MissionRegistry. 6 objective
evaluator types. Star ratings. Palette scarcity (count badges).
paramLocks enforcement. Progressive hint system (Vasquez dialogue).
Mission flow (briefing → build → run → evaluate → debrief).

**Sessions:** 3–4.

**Decoupled from content:** S10b builds the machinery. S10c-Ph1 fills
it with mission data.

**Spec:** `PTIS_S10_SPEC.md` (S10b sections)

---

## S10c-Ph1 — Phase 1 Missions (Vertical Slice)

**What:** 5 mission data definitions (M1–M5). Room unit (shelter as
atmospheric tank with composition checks). Purity/health alarm
sources. Depletable supply units (O₂ bottles, LiOH scrubber, water
jerricans, MRE crate, battery). Buffer tank design (decouple process
from life support). membrane_separator cherry-picked from S9 (for M5
CO₂ scrub).

**Sessions:** 3–4.

**Cherry-picks from S9:** membrane_separator defId + separatorTick
trunk only. Full S9 (CH₂O, R_PHOTOSYNTHESIS, etc.) deferred to
pre-Phase 3.

**Purity implementation:** Room unit gets composition-checking alarm
sources. Buffer tank between process feeds and room air supply.
Contamination builds gradually → WARNING → MAJOR (efficiency drop +
countdown) → CATASTROPHIC (revert). See Purity & Health Mechanics
section above.

**Spec:** `PTIS_S10_SPEC.md` (S10c sections) + this roadmap (purity)

---

## ⚡ VERTICAL SLICE GATE ⚡

5 playable missions. Room with health mechanics. Kerbal-style
play/pause/checkpoint. Star ratings. Equipment scarcity. Vasquez
hints. Buffer tanks with purity consequences. ~503 tests.

---

## S7 — Performance Maps

**What:** VP envelopes, reactor/column maps, limit overlays,
time-series recorder. Canvas-based visualization in the inspector.

**Sessions:** 3–5. All dependencies met (S1 ✓, S3 ✓, S4 ✓, S6 ✓).

**Why here:** Performance maps help players understand reaction
dynamics for Phase 2 missions (Haber equilibrium, cryogenic phase
behavior). Not essential for Phase 1 but significant for player
learning in Phase 2+.

**Spec:** `PTIS_S7_SPEC.md`

---

## S-3D — Three-Dimensional Plant Interface

**What:** Three.js renderer in processThis.html. Grid placement, pipe
routing, dual-view sync (3D ↔ flowsheet). Simulation-driven coloring.
Procedural environment (sky, terrain, hangar).

**Sessions:** 3 (S-3D-1 foundation, S-3D-2 pipes+sync, S-3D-3
polish+color). S-3D-0 (POC) already complete by this point.

**Why here:** The 3D view is the soul of the game — what differentiates
it from a process simulator. Positioned after the vertical slice so
there's a working game to render, but before Phase 2 content so
missions M6–M9 are designed WITH the 3D view available. Also: produces
shareable screenshots for early visibility.

**Spec:** `PTIS_S_3D_SPEC.md`

---

## S10c-Ph2 — Phase 2 Missions

**What:** M6–M9 content (Cold Chain, Heat Integration, Fertilizer,
Cryo Emergency). Cherry-pick remaining S9 registrations needed
(steam_turbine, tank_cryo). Salvage narratives (bow section, chemistry
lab, cargo hold). Population increases (5→7).

**Sessions:** 3–4.

**Spec:** `PTIS_S10_SPEC.md` (relevant S10c sections)

---

## S8 — Unit Groups & Sub-Assemblies

**What:** GroupTemplateRegistry. Blender-style collapse/expand overlay
navigation. Boundary port delegation. Scaling mechanism.
editableParams exposure. Locked templates for campaign composites.

**Sessions:** 4 (S8-1 data model, S8-2 canvas+templates).

**Why here:** Gated by Phase 3 (greenhouse + human composites), not
needed earlier. Phase 1–2 missions use individual units only.

**Spec:** `PTIS_S8_SPEC.md`

---

## S9 — Game Engine Extensions (Remainder)

**What:** CH₂O species registration. R_PHOTOSYNTHESIS,
R_METABOLISM reactions. Any defIds not already cherry-picked
(depletable membrane_separator params if not done in Ph1).
Full trunk documentation.

**Sessions:** 2.

**Spec:** `PTIS_S9_SPEC.md`

---

## S9b — Validation Gate

**What:** Manual integration QC. Composite mock-builds (greenhouse,
human, room at scale). Mission mock-builds (M10 at 7 population).
Mass balance closure verification. Power budget vs NASA data.

**Sessions:** 3–5.

**Spec:** Defined in this roadmap + `PTIS_COMPOSITE_MODELS.md`

---

## S10c-Ph3 — Phase 3 Mission (Biosphere)

**What:** M10 content. Greenhouse and human composite templates via
S8 GroupTemplateRegistry using S9-registered units. Second vent
discovery. Massive power train. Closed-loop biosphere for 7.
Campaign endgame (radio signal hook).

**Sessions:** 3–4.

**Spec:** `PTIS_S10_SPEC.md` + `PTIS_COMPOSITE_MODELS.md` +
`PTIS_BIOSPHERE_POWER_RECONCILIATION.md`

---

## ⚙ CAMPAIGN COMPLETE ⚙

10 missions across 3 phases. Sandbox mode. Closed biosphere.
~576 tests. The full survival-engineering story from crash to colony.

---

## S-TERRAFORM — Planetary Atmosphere Engineering

**Phased implementation:**

| Phase | When | Scope |
|-------|------|-------|
| Ph.1 (display) | Embedded in S5-lite | HUD, dashboard, RH, hardcode fixes |
| Ph.2 (tracking) | Post-campaign | Atmospheric exchange accounting |
| Ph.3 (dynamic) | Post-Ph.2 | tickAtmosphere, blueprints, milestones |
| Ph.4 (endgame) | Post-Ph.3 | BECCS, outdoor bio, visual feedback, victory |

Phase 4 missions (terraforming campaign) are conceptual. Blueprint-
based scale-up, multi-scene management, atmospheric impact visualization.
Architecture designed in `PTIS_S_TERRAFORM_SPEC.md`.

---

## Critical Path

```
S5-lite → S-CLEAN → S-SIM → S6 → S10b → S10c-Ph1
                                              │
                                    ⚡ VERTICAL SLICE ⚡
                                              │
                    S7 ──→ S10c-Ph2 → S8 → S9 → S9b → S10c-Ph3
                                              │
                                    ⚙ CAMPAIGN COMPLETE ⚙
                                              │
                                    S-TERRAFORM Ph.2–4
```

### Parallel Branches

| Branch | Branches from | Merges at | Notes |
|--------|-------------|-----------|-------|
| S-3D-0 (POC) | S-CLEAN | S6 (port design input) | Standalone HTML, no engine deps |
| S-3D (full) | Vertical Slice | S10c-Ph2 (available for design) | 3D view for Phase 2+ missions |
| S7 | Vertical Slice | S10c-Ph2 (player learning aid) | All deps met (S1–S6 complete) |
| S4 (done) | — | S7 (column maps) | ✅ Already complete |
| S-TERRAFORM Ph.1 | Embedded in S5-lite | — | Display only, ~2 hours |

---

## Removed / Deferred

| Item | Status | Reason |
|------|--------|--------|
| S5-full (BFS zones, network solver) | Deferred indefinitely | S5-lite provides right balance |
| S10a (Build/Run state machine) | Absorbed into S-SIM | Identical deliverables |
| HVAC mission | Killed | Not exciting enough as standalone |
| S-TERRAFORM Ph.4 missions | Conceptual | Design exists, not scheduled |
| S-3D deferred topics | Future | LOD, first-person, sound, weather |
| Parameter renaming (snake_case) | Future sprint | ~500 touches, low functional impact |

---

## Document Map

### Active Specs
| Document | Stage | Content |
|----------|-------|---------|
| `PTIS_S5_LITE_SPEC.md` | S5-lite | Tank physics, Cv flow, pressure trace |
| `PTIS_S_CLEAN_SPEC.md` | S-CLEAN | Port naming, source consolidation |
| `PTIS_S_SIM_SPEC.md` | S-SIM | Simulation loop, checkpoint, catastrophic |
| `PTIS_S_3D_SPEC.md` | S-3D-0, S-3D | 3D plant interface |
| `PTIS_S6_SPEC.md` | S6 | Reactor architecture |
| `PTIS_S7_SPEC.md` | S7 | Performance maps |
| `PTIS_S8_SPEC.md` | S8 | Unit groups & sub-assemblies |
| `PTIS_S9_SPEC.md` | S9 | Game engine extensions |
| `PTIS_S10_SPEC.md` | S10b, S10c | Game layer (missions, campaign) |
| `PTIS_S_TERRAFORM_SPEC.md` | S-TERRAFORM | Planetary atmosphere engineering |

### Reference
| Document | Purpose |
|----------|---------|
| `PTIS_ROADMAP_V2.md` | This file |
| `PTIS_DEPENDENCY_MAP.html` | Visual dependency graph (revised) |
| `PTIS_GAME_DESIGN.md` | Creative vision (missions being revised per V2) |
| `PTIS_COMPOSITE_MODELS.md` | Human, greenhouse, room engineering models |
| `PTIS_BIOSPHERE_POWER_RECONCILIATION.md` | Biosphere power budget, NASA validation |
| `PTIS_EQUIPMENT_MATRIX.md` | Canonical equipment tables |

### Completed / Archived
| Document | Status |
|----------|--------|
| `PTIS_S0_SPEC.md` | ✅ Implemented |
| `PTIS_S1_SPEC.md` | ✅ Implemented |
| `PTIS_S2_SPEC.md` | ✅ Implemented |
| `PTIS_S3_SPEC.md` | ✅ Implemented |
| `PTIS_S4_SPEC.md` | ✅ Implemented |
| `PTIS_S5_SPEC.md` | ⛔ Superseded by S5-lite |
| `PTIS_ROADMAP.md` | ⛔ Superseded by V2 |

---

## Open Design Questions

### Resolved (V2)

1. ~~S5-full vs S5-lite~~ → S5-lite. S5-full deferred indefinitely.
2. ~~S10a vs S-SIM~~ → S-SIM absorbs S10a.
3. ~~Mission count and order~~ → 10 missions, 3 gameplay phases +
   terraform endgame. Phase 1 = vertical slice (5 missions).
4. ~~HVAC mission~~ → Killed. Climate control folded into shelter
   upgrades as sub-objectives.
5. ~~Purity mechanics~~ → Composition-based health alarms on room
   unit. Buffer tank decoupling. WARNING → MAJOR → CATASTROPHIC
   ladder with efficiency degradation.
6. ~~3D timing~~ → POC (S-3D-0) early for port design. Full 3D
   post-vertical-slice, pre-Phase 2 content.
7. ~~S6 lite vs full~~ → Full S6. Thermal reactor variants needed
   for temperature limits. Formalization work, not new physics.

### Still Open

1. **Phase 2 mission details:** Cold Chain and Cryo Emergency share
   refrigeration/cryogenic themes. Enough differentiation? Or merge?
2. **Population timing in V2 missions:** Original had rescues at
   M4/M6/M7. V2 moves Power to M4 (same), but CO₂ Scrub is now M5
   (was M5 Air). Rescue schedule needs confirmation with new order.
3. **Phase 3 second vent:** Narrative trigger and location. Original
   had Jin found at M4 near a second vent. V2 Phase 3 needs a THIRD
   heat source for massive power. Nuclear heat source? Larger
   geothermal find? Or the same second vent at higher capacity?
4. **S-TERRAFORM Phase 2–4 scheduling:** Tentative. Depends on
   campaign reception and development capacity.
