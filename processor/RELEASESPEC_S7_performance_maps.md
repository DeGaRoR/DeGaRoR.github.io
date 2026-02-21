# RELEASESPEC_S7_performance_maps.md
# processThis — S7: Performance Maps
# Baseline: v12.10.0 + S1–S6

═══════════════════════════════════════════════════════════════════
GOVERNING SPEC
═══════════════════════════════════════════════════════════════════

  RELEASESPEC_heatStream_perfmaps.md — Phases 1, 3, 4, 5, 7.

Phase 0 (heat stream deletion) completed in v12.
Phase 2 + Phase 6 (limits + alarm) delivered as S1.
This stage delivers the remaining visual infrastructure and maps.

All design decisions, rendering architecture, and use case
inventory per the governing spec. This document provides the
phase mapping and integration notes.


═══════════════════════════════════════════════════════════════════
DEPENDENCY
═══════════════════════════════════════════════════════════════════

  Requires: S1 (limit data for overlays, evaluateLimits)
  Requires: S3 (PR EOS for VP envelopes, bubble/dew, reactor K)
  Requires: S4 (column for Gilliland operating map)
  Optional: S5 (valve Cv map — deferred, no Cv standalone valve)


═══════════════════════════════════════════════════════════════════
DELIVERABLES BY GOVERNING SPEC PHASE
═══════════════════════════════════════════════════════════════════

### Phase 1 — Rendering Infrastructure (from governing spec)

    1.1  pm-* CSS classes
    1.2  pmSetupCanvas() — HiDPI handling
    1.3  pmAxisLayout() — margins, lin/log scale
    1.4  pmDrawAxes() — ticks, labels, title
    1.5  pmPointerTrack() — crosshair, value readout
    1.6  pmDrawMarker() — operating point indicator
    1.7  Color scale utilities (viridis-like palette)

### Phase 3 — Species VP Envelopes (PM-1)

    Curve map: T(x) vs Psat(y, log scale).
    One line per species in composition. Tc dots at terminus.
    PR: Psat from bubble-P iteration (S3).
    Inspector hook: flash_drum, HEX, valve.

### Phase 4 — Dynamic Phase Maps (PM-2, PM-3)

    Pump: bubble P(T) from inlet liquid composition.
      Region below curve: safe (subcooled). Above: cavitation risk.
    Compressor: dew P(T) from inlet vapor composition.
      Region above curve: safe (superheated). Below: condensation risk.
    Computed from actual inlet composition (< 0.1 ms).
    Default curves (water/air) before first solve.
    Inspector hook: pump, compressor.

### Phase 5 — Reactor Feasibility Maps (PM-4, PM-5)

    Field map: T(x) vs P(y) → conversion % (color).
    25×20 grid, T linear, P log. Warm-start from PerfMapData cache.
    Isothermal: direct K-value evaluation per grid cell.
    Adiabatic: iterate T_out at each (T_in, P) using energy balance.
    ~35 ms per reaction. Cached by reaction + composition hash.
    Inspector hook: reactor_equilibrium, reactor_adiabatic.

### Phase 7 — Limit Overlays + Column Map + Inspector Hooks

    Limit region overlays (PM-6):
      LL/HH shading on all maps. Semi-transparent red bands.
      Data from getEffectiveLimits() (S1).
      Overlaid on any performance map with matching axes.

    Column operating map (new, small):
      Gilliland curve: X vs Y.
      Operating point marker at current R/R_min.
      Shows: minimum stages, minimum reflux, actual stages.
      Inspector hook: distillation_column (S4).

    Inspector integration:
      Map canvas embedded in inspector detail panel.
      Click-to-expand for full-screen view.
      Operating point updates on each solve.


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 7a  pm-* CSS + pmSetupCanvas + HiDPI
  [ ] 7b  pmAxisLayout + pmDrawAxes (lin/log)
  [ ] 7c  pmPointerTrack + pmDrawMarker
  [ ] 7d  Color scale utilities
  [ ] 7e  Species VP envelopes (PM-1)
  [ ] 7f  Pump bubble P map (PM-2)
  [ ] 7g  Compressor dew P map (PM-3)
  [ ] 7h  Reactor feasibility maps (PM-4, PM-5)
  [ ] 7i  Limit region overlays (PM-6)
  [ ] 7j  Column Gilliland map
  [ ] 7k  Inspector hooks (flash, pump, compressor, reactor, column)
  [ ] 7l  Tests

  Tests: ~5 new
    - VP envelope: H₂O curve passes through 373K/1atm
    - Reactor map: Haber conversion increases with P (Le Chatelier)
    - Limit overlay: LL/HH regions rendered when limits present
    - Column map: operating point inside feasible region
    - Performance: 30-unit scene with maps < 100ms total

  Gate: all previous + ~5 new pass.
