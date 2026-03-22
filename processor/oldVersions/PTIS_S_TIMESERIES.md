
# PTIS_S_TIMESERIES
PTIS Time Series Visualizer – Integrated Specification  
Status: Draft  
Purpose: Define the conceptual model, UI, and data behavior of the PTIS time‑series visualizer.

---

# 1. Purpose

The Time Series Visualizer is an integrated analysis tool allowing observation of dynamic simulation behavior in PTIS.

Primary goals:

- Validate thermodynamic and life‑support models
- Diagnose system behavior during simulation
- Understand interactions between equipment and environment
- Support development and advanced player reasoning

The visualizer must feel like an **engineering instrument panel**, not a general data analytics tool.

---

# 2. Core Concepts

The visualizer is built around four core objects:

1. Timeline
2. Signals
3. Graphs
4. Graph Sets

---

# 3. Timeline Model

## 3.1 Single Global Timeline

The simulation maintains **one consistent timeline shared by all graphs**.

Rules:

- Every simulation timestep produces one record.
- Graphs read from this single timeline.
- No independent sampling timelines exist.

This ensures:

- visual coherence
- consistent interpretation
- alignment with simulation events

---

## 3.2 Timeline Record

Each timestep generates a snapshot:

```text
timeline_entry:
  time
  simulation_values
```

Conceptually:

```text
timeline = [
  {t:0, values},
  {t:1, values},
  {t:2, values}
]
```

Values correspond to the full simulation state at the timestep boundary.

---

## 3.3 Solver Iterations

Internal solver iterations must **not create timeline entries**.

Only the final converged state of a timestep is stored.

---

## 3.4 Restore Behavior

When restoring a previous simulation state:

1. Timeline is truncated at the restore point
2. Future values are removed
3. New simulation results overwrite the timeline from that point

This prevents timeline branching.

---

# 4. Signals

A **signal** represents a time series extracted from simulation state variables.

Signal identity:

```
object_id + variable_id
```

Examples:

```
habitat_01.o2_partial_pressure
tank_02.pressure
electrolyzer_01.power_draw
human_01.o2_consumption
```

Signals originate from simulation objects.

---

# 5. Signal Sources

Signals may come from:

### Equipment
- duty
- internal temperature
- inlet/outlet flow
- operating state

### Tanks
- pressure
- inventory
- temperature

### Habitat / Rooms
- gas composition
- humidity
- temperature
- pressure

### Humans
- oxygen consumption
- CO2 production
- metabolic heat

### Power Systems
- generation
- load
- deficit
- battery state

---

# 6. Equipment Limits

All equipment models expose operational limits.

Examples:

- max pressure
- max temperature
- max duty
- min flow

Limits behave as **constant signals**.

Example:

```
tank_01.max_pressure
electrolyzer_01.max_temperature
```

These can be dragged into graphs and appear as horizontal reference lines.

---

# 7. Graph Model

A graph contains a set of signals plotted over time.

Graph structure:

```
graph:
  name
  signals[]
  axis_assignments
  display_options
```

Graphs are user‑defined and editable.

---

# 8. Graph Sets

Graphs are grouped into **Graph Sets**.

A graph set represents the complete visualizer layout.

```
graph_set:
  graphs[]
```

Graph sets are stored inside the simulation save file.

This allows persistent diagnostic setups.

---

# 9. UI Overview

The time series visualizer appears as a **dockable analysis panel**.

Default placement: **bottom of the simulation window**.

Three display modes:

1. Collapsed
2. Docked
3. Expanded

---

# 10. UI Layout

```
┌───────────────────────────────────────────────┐
│ Simulation toolbar (play/pause/speed)        │
├───────────────────────────────────────────────┤
│                                               │
│             Simulation View                   │
│                                               │
├───────────────────────────────────────────────┤
│ Tabs: Graphs | Events | Metrics               │
├───────────────┬───────────────────────────────┤
│ Signal tray   │ Graph canvas                  │
│               │                               │
│               │                               │
├───────────────┴───────────────────────────────┤
│ Cursor readout / graph controls               │
└───────────────────────────────────────────────┘
```

---

# 11. Display Modes

## Collapsed

Small bottom bar showing:

- Graph icon
- Event indicator
- Recording indicator

Used when graphs are not actively inspected.

---

## Docked Mode

Bottom panel occupies ~30–40% of screen height.

Simulation remains visible above.

This is the standard operating mode.

---

## Expanded Mode

Panel expands to ~50% screen height.

Used for deep analysis and debugging.

---

# 12. Graph Canvas

The graph canvas renders signal curves.

Features:

- multiple signals
- dual axis support
- zoom and pan
- hover cursor
- event markers
- threshold overlays

Graph style:

- dark background
- thin colored lines
- minimal decorative styling

---

# 13. Signal Tray

The signal tray lists active signals.

Each entry shows:

- color marker
- signal name
- source object
- current value
- axis assignment
- visibility toggle

Users can reorder signals.

---

# 14. Adding Signals

Signals may be added via:

### Drag from Inspector

Variables displayed in the inspector can be dragged directly to the graph.

### Plot Button

Inspector rows include a small plot icon for quick addition.

---

# 15. Interaction Model

### Hover

Displays tooltip containing:

- timestamp
- signal values
- units

### Click

Pins the cursor at a specific timestamp.

### Pan

Drag horizontally to move along timeline.

### Zoom

Mouse wheel or pinch zoom adjusts the time scale.

### Reset

Double click resets zoom.

---

# 16. Event Markers

Simulation events may appear as vertical markers.

Examples:

- blackout
- equipment start/stop
- threshold crossing
- mission events

Markers show labels when hovered.

---

# 17. Threshold Lines

Graphs can display threshold overlays.

Examples:

- minimum breathable O2
- dangerous CO2 concentration
- equipment limits
- safety margins

Thresholds originate from equipment metadata.

---

# 18. Sampling Behavior

Sampling equals simulation timestep.

```
1 simulation step = 1 timeline record
```

There is no separate sampling rate.

---

# 19. Data Storage

Conceptually the timeline stores full simulation snapshots.

```
time -> simulation state snapshot
```

Graphs extract signals from these snapshots.

---

# 20. Data Volume Considerations

Long simulations may generate large timelines.

Possible mitigations:

- snapshot compression
- optional history truncation
- distant history downsampling

These optimizations must preserve the **single timeline abstraction**.

---

# 21. Persistence

Graph sets are saved inside the simulation save file.

This allows:

- persistent graph layouts
- reproducible debugging sessions
- mission‑specific diagnostics

---

# 22. Non Goals

The visualizer will not support:

- spreadsheet analytics
- formula editors
- complex dashboards
- statistical analysis tools

Its role is **system understanding**, not data science.

---

# 23. Design Principles

The system must follow:

### Consistency
All graphs use the same timeline.

### Transparency
Signals map directly to simulation variables.

### Reproducibility
Graph sets persist with the simulation.

### Simplicity
Users define graphs; no predefined templates.

### Engineering Focus
Equipment limits and thresholds are easily visualized.

---

# End of Specification
