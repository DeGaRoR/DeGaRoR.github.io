PTIS S-CLEAN SPEC v2
Changes from v1
Sectionv1v2WhySource consolidationMerge all 3 → one defId + _atmospheric flagMerge source+source_multi only; keep atm as separate source_atm defIdNNG-3: atmospheric intake has computation branching (planet state, humidity, terraformation)Wet air activationNot in scopePhase 2 deliverableTested since v14.3.0, dormant — flip the switchPalette organizationNot in scopeNew Issue 7Growing confusion between defIds and profilessource_pureAssumed neededKeep for now, review laterLow cost, useful for clean flowsheets

Issue 2: Source Architecture (REVISED)
NNG-3 Analysis
source vs source_multi: Same physics. source is literally source_multi with n = { [species]: nDot }. No branching — just parameter interpretation. → Merge.
source_air → source_atm: Different physics. Reads planet state not user params. Will read humidity via getWetAir(). Will respond to terraformation. Deserves distinct inspector (RH%, dew point). Physically distinct equipment. → Keep as separate defId.
Proposed Architecture
defId: source — user-configured process feed. Unified tick:

par.n (object) → multi-component
par.species + par.nDot → single-component (backward compat)
Profiles: source_pure, source_mix

defId: source_atm — atmospheric intake (renamed from source_air). Dedicated tick:

Reads SimSettings.getWetAir() (wet air activation!)
T, P locked to planet
Only user param: par.flowScale
Profile: source_atmosphere (tierless boundary)
All terraformation hooks land here

On source_pure
I'd say keep it. The cost is essentially zero — the unified tick already handles the par.species/par.nDot path as backward-compat. It's genuinely useful for simple flowsheets ("give me 1 mol/s of N₂") without needing to construct a composition object. It also demonstrates the profile concept clearly: same defId, same tick, different default parameterization. If it ever becomes dead weight, retiring it is a mechanical find-and-replace converting { species: 'N2', nDot: 1.0 } to { n: { N2: 1.0 } }.
Wet Air Activation
One-line change in source_atm tick:
BEFORE: for (const [sp, frac] of Object.entries(atm.air)) { ... }
AFTER:  const wetAir = SimSettings.getWetAir();
        for (const [sp, frac] of Object.entries(wetAir)) { ... }
New tests: T-SRC-WET1 (Planet X H₂O ≈ 2.6%), T-SRC-WET2 (Mars no H₂O), T-SRC-WET3 (fractions sum 1.0).

Issue 7: Palette Organization (NEW)
defId → Profile → Tier Map (current state + post-S-CLEAN)
BOUNDARY (tierless)
defId: source ─────────┬─ profile: source_pure       [tierless]
                       └─ profile: source_mix        [tierless]
defId: source_atm ─────── profile: source_atmosphere  [tierless]
defId: sink ───────────── profile: sink               [tierless]
defId: grid_supply ────── profile: grid_supply        [tierless]
defId: sink_electrical ── profile: power_sink         [tierless]
PROCESS EQUIPMENT (tiered)
defId: pump ───────────── profile: pump               [T1, T2, T3]
defId: compressor ─────── profile: compressor         [T1, T2, T3]
defId: electric_heater ── profile: electric_heater    [T1, T2, T3]
defId: air_cooler ─────── profile: air_cooler         [T1, T2, T3]
defId: valve ──────────── profile: valve              [T1, T2, T3]
defId: mixer ──────────── profile: mixer              [T1, T2]
defId: splitter ───────── profile: splitter           [T1, T2]
defId: hex ────────────── profile: hex                [T1, T2, T3]
defId: flash_drum ─────── profile: flash_drum         [T1, T2]
defId: distillation_col ─ profile: distillation_col   [T1]
defId: reactor_eq ─────── profile: reactor_eq         [T1, T2]
defId: gas_turbine ────── profile: gas_turbine        [T1, T2]
STORAGE (tiered)
defId: tank ───────────┬─ profile: tank_atmospheric   [T1, T2]
                       └─ profile: tank_pressure      [T1, T2, T3]
defId: battery ────────── profile: battery            [T1, T2]
POWER MANAGEMENT (tierless)
defId: power_hub ─────── profile: power_hub           [tierless]
(Tier counts indicative — to be confirmed against actual ProfileRegistry.)
Palette Filter Tabs
[ Dev ]   [ All ]   [ ∅ ]   [ T1 ]   [ T2 ]   [ T3 ]
Dev — Every defId, one entry each. No limits, no profiles, free params. What a traditional process simulator would show. Also useful for testing.
All — All profiled units combined (game palette preview). Everything in ∅ + T1 + T2 + T3.
∅ (tierless) — Boundary units (sources, sinks, grid), infrastructure (power_hub), and future tierless units (reservoir).
T1 / T2 / T3 — Only profiles that have that tier. T3 won't show mixer (only has T1, T2).
Dev Tab Implementation
When palette mode = dev, placeUnit() sets u.profileId = null and u.devMode = true. Alarm system skips limit checks when devMode === true. Every defId gets exactly one entry regardless of profile count.
Why This Works for Terraformation
source_atm is tierless — it represents "the planet's atmosphere," not something you purchase. It sits in ∅ alongside other infrastructure. As terraformation shifts atmospheric composition, source_atm output changes automatically. The planet doesn't have tiers.

Issues 1, 3, 4, 5, 6: Unchanged from v1

Issue 1: Port naming harmonization (same migration table)
Issue 3: P_column_bar → P_column (Pa) — the only NNG-8 violation
Issue 4: Broad param renaming — deferred
Issue 5: Categories — no action needed
Issue 6: Display names (source_atm → "Atmospheric Intake", sink_electrical → "Power Sink")


Implementation Plan (REVISED)
Phase 1 — Port Naming (~360 touches, mechanical)
Port renames per migration table. Scene migration function. Full test gate.
Phase 2 — Source Architecture + Wet Air (architectural)

Unified source tick (par.n + par.species backward compat)
Profiles: source_pure, source_mix
Rename source_air → source_atm, activate getWetAir()
Profile: source_atmosphere
Retire source_multi defId
Migrate 80 + 4 test refs, update atmospheric reference values
3 new tests (T-SRC-WET1/2/3)
Gate: ≥478 tests, 0 failures

Phase 3 — Distillation Bar Fix (~10 touches, NNG-8)
P_column_bar → P_column (Pa) everywhere.
Phase 4 — Electrical Ports + Names (~20 touches)
grid_supply.out → elec_out, sink_electrical.in → elec_in, display names.
Phase 5 — Palette Organization (UI-only, independent)
Filter tabs, dev mode flag, limit check bypass. No physics impact.

Decision Log
DecisionChosenRationaleSource architectureMerge 2, keep atm separateNNG-3: computation branching = separate defIdsource_pureKeep for nowZero cost, useful, retire later if neededWet airActivate nowTested infrastructure, dormant since v14.3.0PaletteFiltered tabs (Dev/All/∅/T1/T2/T3)Clean Dev vs Game separationsource_atm namingsource_atm not source_airFuture-proof for non-air atmospheresDistillation barFix nowOnly NNG-8 violation in codebaseParam renamingDefer~500 touches, low value