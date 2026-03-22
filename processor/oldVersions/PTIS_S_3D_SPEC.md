# S-3D: Three-Dimensional Plant Interface

### processThis v14.x

**Status:** DESIGN — not yet implemented.
**Depends on:** S5-lite (tank/reservoir visuals), S-SIM (game loop, checkpoints).
**Phases:** 4 sessions (S-3D-0 through S-3D-3).

---

## 1. Philosophy

The 3D world is the game. Players don't draw flowsheets — they
build plants. They pick a compressor, drop it on the ground, run
a pipe to a tank, open the valve, and watch pressure climb. The
flowsheet exists as an auto-generated schematic companion for
analysis, not as the primary interface.

Everything is grid-snapped. Everything is procedural. Everything
fits in one file. No imported models, no texture files, no asset
pipeline. A unit's entire 3D appearance is ~200 bytes of JSON
parameters that deterministically generate geometry at runtime.

**Design principles:**
- Player places equipment in 3D, flowsheet follows automatically
- Grid constraint IS the aesthetic — enforces tidy plants by default
- Primitives + procedural detail > imported models
- Simulation-driven coloring: same data, same palette, both views
- The player routes all pipes — no auto-routing, no frustration

---

## 2. Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐
│   3D WORLD VIEW  │     │    FLOWSHEET      │
│  (primary)       │     │  (companion)      │
│                  │     │                   │
│  Grid placement  │     │  Auto-layout or   │
│  Pipe routing    │     │  manual drag      │
│  Orbit camera    │     │  SVG (existing)   │
│  Three.js canvas │     │                   │
└────────┬─────────┘     └────────┬──────────┘
         │                        │
         └──────────┬─────────────┘
                    │
         ┌──────────▼──────────┐
         │  CONNECTION GRAPH   │
         │  (single source of  │
         │   truth)            │
         │                     │
         │  units: Map         │
         │  connections: Array │
         │  simulation state   │
         └─────────────────────┘
```

**Toggle, not overlay.** Full-screen 3D or full-screen flowsheet.
Hotkey (Tab) or button to switch. Both synchronized through the
shared connection graph and unit state.

---

## 3. Grid System

### 3.1 World Grid

```
Y (up)
│
│   height levels: 0 (ground), 1, 2, 3, ...
│
└───── X (east)
      /
     Z (south)
```

| Parameter | Value | Rationale |
|---|---|---|
| Cell size | 1.0 m | Pilot-plant scale equipment fits 1-4 cells |
| Grid extent | 64 × 64 cells | ~4000 m², enough for large plants |
| Height levels | 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0 m | 0.5 m increments |
| Pipe heights | 0.5 (low), 1.5 (normal), 2.5 (high) | Three standard rack levels |

All positions snap to grid intersections. No free placement.
Equipment occupies rectangular blocks of cells. Pipes run along
grid edges at fixed heights.

### 3.2 Grid Cell Occupancy

```javascript
// Grid occupancy tracker
const GridOccupancy = {
  // Key: "x,z,y" string. Value: { type: 'unit'|'pipe', id: string }
  cells: new Map(),

  mark(x, z, y, type, id) {
    const key = `${x},${z},${y}`;
    this.cells.set(key, { type, id });
  },

  free(x, z, y) {
    this.cells.delete(`${x},${z},${y}`);
  },

  isOccupied(x, z, y) {
    return this.cells.has(`${x},${z},${y}`);
  },

  // Check rectangular block (for equipment placement)
  canPlaceBlock(x0, z0, w, d, heights) {
    for (let x = x0; x < x0 + w; x++) {
      for (let z = z0; z < z0 + d; z++) {
        for (const y of heights) {
          if (this.isOccupied(x, z, y)) return false;
        }
      }
    }
    return true;
  },

  // Check segment (for pipe routing)
  canPlaceSegment(from, to) {
    const cells = rasterizeSegment(from, to);
    for (const [x, z, y] of cells) {
      if (this.isOccupied(x, z, y)) return false;
    }
    return true;
  }
};
```

`rasterizeSegment` is a 3D Bresenham line rasterization along
grid cells. Axis-aligned segments (which all pipe segments are)
reduce to simple range iteration along one axis.

### 3.3 Grid Rendering

Subtle ground grid visible in 3D view. Thin lines, low opacity,
fading with distance. No grid in flowsheet. Grid renders on the
ground plane (y=0) only — pipe height levels are shown as faint
horizontal planes when in pipe-routing mode.

---

## 4. Equipment Placement

### 4.1 Placement Flow

```
Player selects unit type from palette
  → Ghost preview follows cursor, snapped to grid
  → Green if valid placement, red if blocked
  → Click to place
  → Unit appears in 3D at grid position
  → Flowsheet auto-creates corresponding block
  → Connection ports appear as colored stubs on the 3D model
```

### 4.2 Unit Data Model (Extended)

```javascript
unit = {
  // Existing fields (unchanged)
  id, defId, profileId, name, params, inventory,

  // Flowsheet coordinates (existing)
  x: 400, y: 300, w: 80, h: 40,

  // 3D world coordinates (new)
  x3d: 5,          // grid X (integer)
  z3d: 8,          // grid Z (integer)
  rot3d: 0,        // rotation: 0, 90, 180, 270 degrees
  // y3d always 0 (ground level) — equipment sits on ground

  // 3D footprint (from unit registry, not editable)
  w3d: 2,          // width in grid cells
  d3d: 2,          // depth in grid cells
}
```

### 4.3 Equipment Footprints

Each unit type has a grid footprint defined in the registry:

| Unit | Footprint (w × d) | Visual height | Notes |
|---|---|---|---|
| Tank (atmospheric) | 2 × 2 | 2.5 m | Tall cylinder |
| Tank (pressure) | 2 × 2 | 2.0 m | Shorter, thicker |
| Reservoir | 3 × 3 | 1.0 m | Wide, low |
| Reactor | 2 × 2 | 2.0 m | Box shape |
| Heat exchanger | 1 × 3 | 1.5 m | Horizontal cylinder |
| Pump | 1 × 1 | 0.8 m | Small |
| Compressor | 2 × 2 | 1.5 m | Medium box |
| Valve/restriction | 1 × 1 | varies | Inline on pipe |
| Splitter (flow divider) | 1 × 1 | varies | Inline on pipe |
| Source | 1 × 1 | 1.0 m | Boundary marker |
| Sink | 1 × 1 | 1.0 m | Boundary marker |
| Greenhouse | 3 × 4 | 2.0 m | Transparent dome |
| Solar panel | 2 × 1 | 0.5 m | Flat, tilted |

Footprints can be tuned in the editor. Rotation swaps w and d.

### 4.4 Port Positions in 3D

Each port has a position relative to the unit's 3D bounding box,
defined as side + height:

```javascript
// Port position definition (in unit registry visual params)
portPositions: {
  mat_in:   { side: 'left',   height: 'mid' },
  gas_out:  { side: 'top',    height: 'high' },
  liq_out:  { side: 'left',   height: 'low' },
  vent:     { side: 'right',  height: 'high' },
  overflow: { side: 'right',  height: 'low' }
}
```

Side: left, right, front, back, top. Rotates with equipment.
Height maps to pipe rack levels:

| Height tag | World Y | Pipe level |
|---|---|---|
| low | 0.5 m | Low rack |
| mid | 1.5 m | Normal rack |
| high | 2.5 m | High rack |

Port stubs render as short pipe segments extending from the
equipment body to the edge of the equipment's grid footprint.
This is where pipe waypoints connect.

---

## 5. Pipe Routing

### 5.1 Routing Flow

```
Player clicks output port stub on unit A
  → "Routing mode" active, pipe preview follows cursor
  → Click on grid node → waypoint placed (if cell is free)
  → Click another grid node → segment drawn to new waypoint
  → Repeat as needed
  → Click input port stub on unit B → connection complete
  → Right-click or Escape → cancel routing
```

All waypoints snap to grid nodes at one of the three pipe
height levels. All segments are axis-aligned (rectilinear).
Diagonal segments are not allowed — every turn is a right angle.

### 5.2 Segment Rules

```
Allowed moves from any waypoint:
  ±X (horizontal east/west)
  ±Z (horizontal north/south)
  ±Y (vertical up/down between height levels)

NOT allowed:
  Diagonal in XZ plane
  Diagonal in any plane
  Segments crossing occupied cells
```

### 5.3 Connection Data Model

```javascript
connection = {
  id: 'conn-17',
  from: { unitId: 'comp-1', portId: 'mat_out' },
  to:   { unitId: 'tank-1', portId: 'mat_in' },

  // 3D routing (new, optional — absent = default straight route)
  waypoints: [
    { x: 5, z: 8, y: 1.5 },
    { x: 5, z: 12, y: 1.5 },
    { x: 9, z: 12, y: 1.5 }
  ]
}
```

The simulation reads only `from` and `to`. Waypoints are purely
visual. The flowsheet ignores waypoints and draws its own layout.

If a connection has no waypoints (created from flowsheet or
imported from legacy save), the 3D view draws a default route:
straight horizontal at the higher of the two port heights, with
vertical drops/rises at each end.

### 5.4 Pipe Collision Check

On each waypoint placement:

```javascript
function canPlaceWaypoint(prevPoint, newPoint) {
  // Must be axis-aligned
  const axes = [
    newPoint.x !== prevPoint.x,
    newPoint.y !== prevPoint.y,
    newPoint.z !== prevPoint.z
  ];
  if (axes.filter(Boolean).length !== 1) return false;

  // Rasterize cells along segment
  const cells = rasterizeSegment(prevPoint, newPoint);

  // Check each cell
  for (const [x, z, y] of cells) {
    if (GridOccupancy.isOccupied(x, z, y)) return false;
  }

  return true;
}
```

Rejected placement: red flash on the segment preview, waypoint
not placed. Player adjusts and tries again.

### 5.5 Pipe Rendering

```javascript
function renderPipe(connection, scene3d) {
  const path = [
    getPortWorldPos(connection.from),
    ...connection.waypoints.map(w => gridToWorld(w)),
    getPortWorldPos(connection.to)
  ];

  for (let i = 0; i < path.length - 1; i++) {
    // Straight cylinder between consecutive points
    addCylinder(path[i], path[i + 1], PIPE_RADIUS, material);

    // Elbow sphere at each waypoint (not at start/end ports)
    if (i > 0) {
      addSphere(path[i], PIPE_RADIUS * 1.2, material);
    }
  }
}
```

Constants:
- `PIPE_RADIUS`: 0.06 m (approximately 2-inch nominal pipe)
- Elbow sphere slightly larger than pipe for visible joint

### 5.6 Pipe Editing

**Delete pipe:** Select connection (click on pipe segment), press
Delete. Connection removed from graph, cells freed, flowsheet
connection removed.

**Reroute pipe:** Delete and re-route. No drag-editing in first
version. Simple and sufficient.

**Future enhancement:** Click-drag individual waypoints to
reroute segments. Not in S-3D scope.

### 5.7 Inline Equipment

Valves, restrictions, and flow dividers sit inline on pipes
rather than on the ground. When placed, they occupy one pipe
segment — the segment splits into: segment → unit → segment.

Placement: player selects valve from palette, then clicks an
existing pipe segment. The valve appears at the midpoint of
that segment. The segment's grid cell is replaced by the valve's
cell. The connection splits into two connections in the graph
(upstream → valve, valve → downstream).

---

## 6. Parametric Unit Editor

### 6.1 Purpose

Separate HTML tool for designing unit 3D appearances. Output is
JSON parameter sets pasted into the unit registry. Not shipped
to players — development tool only.

### 6.2 Editor Layout

```
┌───────────────────────┬──────────────────────────┐
│                       │ UNIT: [Tank ▼]           │
│                       │                          │
│                       │ ── Body ──               │
│   Live 3D Preview     │ type     [cylinder ▼]    │
│                       │ radius   [=======○──] .3 │
│   Orbit camera        │ height   [=========○] 1.2│
│   Grid ground plane   │ cap      [hemi     ▼]    │
│   Ambient + key light │ wall     [==○──────] .01 │
│                       │                          │
│                       │ ── Subparts ──           │
│                       │ [+ Add primitive]        │
│                       │  ► Ring: r=.32 y=.4      │
│                       │  ► Ring: r=.32 y=.8      │
│                       │  ► Cone: bottom, h=.3    │
│                       │                          │
│                       │ ── Material ──           │
│                       │ preset [brushed steel ▼] │
│                       │ base hue  [====○───] .58 │
│                       │ saturation[==○─────] .15 │
│                       │ roughness [=====○──] .7  │
│                       │ wear      [=○──────] .2  │
│                       │                          │
│                       │ ── Procedural Detail ──  │
│                       │ ☑ flanges (at ports)     │
│                       │ ☑ stiffeners  count: [3] │
│                       │ ☑ legs        count: [4] │
│                       │   leg height  [===○─] .4 │
│                       │ ☐ scaffolding levels:[2] │
│                       │ ☑ gauge       count: [1] │
│                       │ ☐ ladder                 │
│                       │ ☐ handrail               │
│                       │                          │
│                       │ ── Ports ──              │
│                       │ mat_in:  left,  mid  [●] │
│                       │ gas_out: top,   high [●] │
│                       │ liq_out: left,  low  [●] │
│                       │ vent:    right, high [●] │
│                       │ overflow:right, low  [●] │
│                       │                          │
│                       │ [Export JSON] [Copy]      │
└───────────────────────┴──────────────────────────┘
```

Every slider change regenerates the mesh instantly.

### 6.3 Three Layers

**Layer 1: Body composition.**

The body is the primary recognizable silhouette. Composed from
primitives with positioning parameters:

| Primitive | Parameters |
|---|---|
| Cylinder | radius, height, radialSegments, openEnded |
| Box | width, height, depth |
| Cone | radiusTop, radiusBottom, height |
| Sphere | radius |
| Torus | radius, tubeRadius, arc |
| HemiSphere | radius (for vessel caps) |

A unit body is 1–4 primitives composed together. A tank is a
cylinder + two hemisphere caps. A heat exchanger is a horizontal
cylinder + two disc tube sheets. A reactor is a box with a
cylinder top section. The editor lets you add primitives, set
their relative position and rotation, and see the result live.

```json
{
  "body": [
    { "type": "cylinder", "radius": 0.3, "height": 1.0, "y": 0.5 },
    { "type": "hemisphere", "radius": 0.3, "y": 1.0, "flip": false },
    { "type": "hemisphere", "radius": 0.3, "y": 0.0, "flip": true }
  ]
}
```

**Layer 2: Procedural material.**

Shader-based, no texture files. Controlled by uniform parameters:

| Parameter | Range | Effect |
|---|---|---|
| baseHue | 0–1 | HSL hue of base metal/paint |
| saturation | 0–1 | Color saturation |
| lightness | 0.2–0.8 | Base brightness |
| roughness | 0–1 | Specular spread |
| metalness | 0–1 | Metallic vs dielectric |
| wearAmount | 0–1 | Edge wear / weathering |
| panelLineScale | 0–0.05 | Width of panel line grooves |
| noiseScale | 0–1 | Procedural surface variation |
| noiseFrequency | 1–20 | Scale of noise pattern |

Material presets provide starting points:

| Preset | Typical use |
|---|---|
| Brushed steel | Tanks, vessels, structural |
| Painted vessel | Reactors, columns (color-coded) |
| Insulated wrap | Heat exchangers, cryogenic equipment |
| Cast iron | Pumps, valve bodies |
| Copper | Heat transfer surfaces |
| Transparent | Greenhouses, sight glasses |

The shader is a single Three.js ShaderMaterial with all parameters
as uniforms. Material change = uniform update, no recompile.

```json
{
  "material": {
    "preset": "brushed_steel",
    "baseHue": 0.58,
    "saturation": 0.12,
    "roughness": 0.7,
    "metalness": 0.85,
    "wearAmount": 0.15
  }
}
```

**Layer 3: Procedural details.**

Generated from rules, not hand-placed. Each detail type has a
generator function that reads the body geometry and parameters:

| Detail | Generator input | Output geometry |
|---|---|---|
| Flanges | Port positions + body radius | Torus ring + bolt circles at each port |
| Pipe stubs | Port positions + direction | Short cylinders extending to grid edge |
| Stiffener rings | Body height + count | N torus rings evenly spaced on body |
| Legs/base | Body footprint + count + height | Cylinder legs + ring base or skirt |
| Scaffolding | Body bbox + level count | Lattice frame (thin box segments) |
| Gauges | Body surface + count + face | Disc + needle + housing on vessel wall |
| Nameplate | Body surface + face | Small rectangle with unit label |
| Ladder | Body height + side | Vertical bars + horizontal rungs |
| Handrail | Body top + perimeter | Rail posts + horizontal rail |
| Nozzles | Port count | Raised weld pads around port penetrations |

All detail generators share a consistent visual weight so
different unit types look like they belong in the same plant.

```json
{
  "details": {
    "flanges": true,
    "stiffeners": { "enabled": true, "count": 3 },
    "legs": { "enabled": true, "count": 4, "height": 0.4, "style": "cylinder" },
    "scaffolding": { "enabled": false },
    "gauges": { "enabled": true, "count": 1, "face": "front" },
    "ladder": { "enabled": false },
    "handrail": { "enabled": false },
    "nameplate": { "enabled": true, "face": "front" }
  }
}
```

### 6.4 Editor Output

The complete visual definition for a unit type:

```json
{
  "unitType": "tank_atmospheric",
  "footprint": { "w": 2, "d": 2 },
  "body": [
    { "type": "cylinder", "radius": 0.3, "height": 1.0, "y": 0.5 },
    { "type": "hemisphere", "radius": 0.3, "y": 1.0 },
    { "type": "hemisphere", "radius": 0.3, "y": 0.0, "flip": true }
  ],
  "material": {
    "preset": "brushed_steel",
    "baseHue": 0.58,
    "saturation": 0.12,
    "roughness": 0.7,
    "metalness": 0.85,
    "wearAmount": 0.15
  },
  "details": {
    "flanges": true,
    "stiffeners": { "enabled": true, "count": 3 },
    "legs": { "enabled": true, "count": 4, "height": 0.4 },
    "gauges": { "enabled": true, "count": 2, "face": "front" },
    "nameplate": { "enabled": true, "face": "front" }
  },
  "ports": {
    "mat_in":   { "side": "left",  "height": "mid" },
    "gas_out":  { "side": "top",   "height": "high" },
    "liq_out":  { "side": "left",  "height": "low" },
    "vent":     { "side": "right", "height": "high" },
    "overflow": { "side": "right", "height": "low" }
  }
}
```

This entire definition is ~400 bytes minified. All unit types
together: ~5 KB. Negligible in a 28,000-line file.

### 6.5 Mesh Generation at Runtime

```javascript
function generateUnitMesh(visualDef, unitState) {
  const group = new THREE.Group();

  // Layer 1: body primitives
  for (const prim of visualDef.body) {
    group.add(createPrimitive(prim));
  }

  // Layer 2: apply material
  const mat = createProceduralMaterial(visualDef.material, unitState);
  group.traverse(child => {
    if (child.isMesh) child.material = mat;
  });

  // Layer 3: procedural details
  if (visualDef.details.flanges) {
    group.add(generateFlanges(visualDef));
  }
  if (visualDef.details.stiffeners?.enabled) {
    group.add(generateStiffeners(visualDef));
  }
  if (visualDef.details.legs?.enabled) {
    group.add(generateLegs(visualDef));
  }
  // ... etc for each detail type

  // Merge all geometry into single buffer for performance
  return mergeGroup(group);
}
```

The `mergeGroup` step is critical: it combines all sub-meshes
into a single BufferGeometry per unit. With 30 units × ~100
sub-meshes each, unmerged = 3,000 draw calls (bad). Merged =
30 draw calls (fine).

---

## 7. Simulation-Driven Coloring

Same palette, both views. The player selects a coloring mode
and all equipment + pipes respond identically in 3D and flowsheet.

### 7.1 Color Modes

| Mode | What's colored | Scale |
|---|---|---|
| Default | Equipment by type, pipes by stream type | Fixed palette |
| Temperature | All surfaces by T | Blue (cold) → red (hot) |
| Pressure | All surfaces by P | Green (low) → red (high) |
| Composition | Pipes by dominant species | Per-species color, blended for mixtures |
| Flow rate | Pipes by flow magnitude | Thin/dim (low) → thick/bright (high) |
| Alarms | Equipment with active alarms | Severity color (yellow/orange/red) |

### 7.2 Implementation

Coloring is applied by updating material uniforms, not by
regenerating geometry:

```javascript
function applyColorMode(scene3d, mode, simState) {
  for (const [uid, meshGroup] of unitMeshes) {
    const state = simState.get(uid);
    switch (mode) {
      case 'temperature':
        const tNorm = (state.T - T_MIN) / (T_MAX - T_MIN);
        meshGroup.material.uniforms.colorOverride.value.set(
          tempColorScale(tNorm)
        );
        break;
      case 'pressure':
        // similar
        break;
      case 'default':
        meshGroup.material.uniforms.colorOverride.value.set(0, 0, 0, 0);
        break;
    }
  }
}
```

Pipe coloring works the same way — each pipe segment's material
gets a uniform update based on the stream data from the
connection it represents.

---

## 8. Camera and Controls

### 8.1 Orbit Camera

Standard Three.js OrbitControls (or minimal equivalent):

| Control | Action |
|---|---|
| Left drag | Orbit around plant center |
| Right drag | Pan |
| Scroll | Zoom |
| Middle click | Reset to default view |

Camera target auto-adjusts to center of placed equipment.
Zoom clamped to prevent going underground or too far.

### 8.2 Camera Presets

| Key | View | Use case |
|---|---|---|
| 1 | Top-down orthographic | Planning, layout |
| 2 | 45° isometric | General overview |
| 3 | Ground-level perspective | "Walking the plant" |
| 0 | Fit all equipment | Reset view |

---

## 8B. View Layout

### 8B.1 Two Layout Modes

The player chooses their preferred layout. Both are always
available via a toolbar button or keyboard shortcut.

**Toggle mode** (default, any screen):

```
┌─────────────────────────────────────────┐
│                                         │
│          3D VIEW  or  FLOWSHEET         │
│              full screen                │
│                                         │
│                       [Tab] to switch   │
└─────────────────────────────────────────┘
```

One view visible at a time. The hidden view's renderer is paused
(3D stops requestAnimationFrame, flowsheet skips render calls).
On switch, the active view does a full state refresh.

**Split mode** (ultrawide / player preference):

```
┌────────────────────┬────────────────────┐
│                    │                    │
│     3D VIEW        │    FLOWSHEET       │
│                    │                    │
│                    │                    │
└────────────────────┴────────────────────┘
           ← drag to resize →
```

Both views live simultaneously. Draggable divider for resize.
Both update after every solve/tick. Flowsheet rendering is cheap
(SVG reflow), so the cost is minimal.

### 8B.2 Implementation

```javascript
const viewMode = { layout: 'toggle', active: '3d' }; // or 'split'

function setLayout(mode) {
  if (mode === 'toggle') {
    container3d.style.display = viewMode.active === '3d' ? 'block' : 'none';
    containerFlow.style.display = viewMode.active === 'flow' ? 'block' : 'none';
    dividerEl.style.display = 'none';
  } else {
    container3d.style.display = 'block';
    containerFlow.style.display = 'block';
    dividerEl.style.display = 'block';
    // CSS grid or flex handles proportions
  }
  viewMode.layout = mode;
}

function toggleView() {
  if (viewMode.layout === 'toggle') {
    viewMode.active = viewMode.active === '3d' ? 'flow' : '3d';
    setLayout('toggle');
  }
  // In split mode, Tab does nothing (both visible)
}
```

### 8B.3 Toolbar Integration

```
[3D] [Split] [Flow]   ── view mode selector (radio buttons)
```

Keyboard: Tab = toggle between views (in toggle mode).
Keyboard: F11 or ` = toggle between toggle/split layout.

The transport controls (Step, Play, Pause, Restore, Save, Speed)
remain in a shared toolbar visible in both modes. The inspector
panel attaches to whichever view the player last clicked in.

---

## 9. Planet Environment

### 9.1 Procedural Terrain

The ground plane is not flat — it has subtle procedural terrain
generated from simplex noise, tinted to match the planet:

| Planet | Ground color | Terrain amplitude | Features |
|---|---|---|---|
| Planet X | Dark purple-brown | Low rolling hills | Volcanic vents (distant) |
| Mars | Rust red-orange | Rocky, cratered | Distant mesa formations |
| Titan | Dark brown-orange | Smooth, lake-like | Methane shore (distant) |
| Venus | Grey-yellow | Flat, cracked | Acid erosion patterns |
| Earth | Green-brown | Gentle hills | Grass/soil transition |

Terrain is a subdivided plane with vertex displacement from
noise. One draw call. No LOD needed at this scale.

### 9.2B Starting Base: The Crashed Hangar

The narrative anchor. "Your cargo module survived the crash.
This is your shelter, your workshop, your only protection."
It frames the entire plant — equipment goes inside or around it.

**Approach: hard-coded shell + procedural surface.**

The hangar shape doesn't need to be parametric — there's only
one. But the surface benefits from the same procedural material
system as equipment (metalness, wear, rust, panel lines).

```javascript
function generateHangar() {
  const group = new THREE.Group();

  // Main arch: half-cylinder, 12m wide, 20m long, 6m tall
  const archGeom = new THREE.CylinderGeometry(
    6, 6, 20, 32, 4, true, 0, Math.PI
  );
  // Rotate to arch orientation, apply crash tilt (8-10°)

  // Support ribs: thin box rings every 2m along arch
  for (let i = 0; i < 10; i++) {
    const rib = archFollowingRib(i * 2, ribThickness);
    group.add(rib);
  }

  // Wall panels: planes filling between ribs
  // Some panels missing (crash damage) — skip panels at indices [3,7,8]
  // Remaining panels slightly displaced/rotated for damage look

  // Floor: large scratched metal plane
  // Broken section: tilted panels hanging from one edge
  // Debris: scattered box primitives outside the breach

  return mergeGroup(group);
}
```

**Crash narrative details:**

| Element | Implementation | Visual effect |
|---|---|---|
| Crash tilt | Rotate entire hangar 8° on Z axis | Reads instantly as "not landed normally" |
| Breach | Omit wall panels on one side + tilted hanging panels | Open wound in the structure |
| Scorch marks | Dark circle in terrain noise around base | Impact zone |
| Crash furrow | Groove in terrain displacement stretching away | You slid to a stop here |
| Scattered debris | 3–5 tilted boxes at furrow's end | Cargo that didn't make it |
| Interior lighting | 2 point lights inside hangar, warm tone | "Power still works, barely" |

Material: heavy-wear variant of the steel shader. High rust,
prominent panel lines, patchy paint over bare metal. Same shader
as equipment but with wear cranked to 0.8+.

**Estimated geometry:** ~50 lines of code for the shell, ~30 for
damage details. One merged mesh, one draw call. Fits the
procedural constraint completely.

**Grid integration:** The hangar footprint occupies a fixed block
of grid cells (approximately 12×20 = 240 cells). Equipment can
be placed inside (on interior grid cells) or outside. The hangar
is placed at scene creation, not moveable.

### 9.2C Surroundings

The landscape needs landmark features to not feel empty. All
procedural, all distant or simple:

| Feature | Geometry | Purpose |
|---|---|---|
| Distant mountains | Jagged low-poly ring of displaced cones at far distance | Horizon line, sense of scale |
| Rock formations | 3–5 displaced icosahedrons near the base | Local texture, break up flat terrain |
| Crash furrow | Depression in terrain noise, dark material | Narrative: you arrived here violently |
| Wreckage pieces | 2–3 large tilted boxes at furrow's end | Scattered cargo, potential future salvage points |
| Atmosphere haze | Fog or gradient overlay fading distant objects | Depth, planet atmosphere feel |

All planet-specific in color. Mars rocks are red-orange. Titan
rocks are dark ice-brown. Planet X rocks are purple-grey.

Implementation: ~100 lines of procedural geometry. ~5 extra draw
calls. Mountains as a single merged ring mesh. Rocks as merged
icosahedron cluster. Wreckage as merged box set.

**Fog/atmosphere:**

```javascript
scene3d.fog = new THREE.FogExp2(planetHazeColor, density);
// Planet X: purple haze, density 0.008
// Mars: salmon dust, density 0.012
// Titan: orange murk, density 0.025 (very thick)
// Venus: yellow acid, density 0.035 (can barely see distance)
// Earth: light blue, density 0.004
```

Fog density also serves gameplay: on Titan, you can barely see
distant equipment. On Earth, the whole plant is visible. This
is emergent difficulty from the planet choice.

### 9.2 Sky

Procedural sky shader matching planet atmosphere:

| Planet | Sky treatment |
|---|---|
| Planet X | Purple-orange gradient, large dim sun, two moons |
| Mars | Salmon pink, small bright sun, thin atmosphere haze |
| Titan | Orange haze, no visible sun, diffuse glow |
| Venus | Uniform yellow-grey overcast, no sun visible |
| Earth | Blue gradient, white sun, standard |

Day/night cycle driven by TimeClock.t — same time source as
the CSS backgrounds they replace. Sky shader reads time uniform,
adjusts sun position, light color, and sky gradient.

### 9.3 Lighting

**Goal:** HDRI-adjacent quality with zero external assets.

Real HDRI wraps the scene in a photograph — every pixel is a light
source. We can't store HDR images in a single file, but we CAN
render the procedural sky shader to a small cube texture and use
it as an environment map. This gives metallic surfaces realistic
reflections of the planet sky and provides subtle ambient fill
from all directions — the two things that make HDRI look good.

**Light sources:**

| Light | Type | Role | Count |
|---|---|---|---|
| Sun | Directional | Primary illumination, shadows, time-driven position and color | 1 |
| Sky/ground | Hemisphere | Ambient fill, planet-tinted (sky color above, ground color below) | 1 |
| Environment map | PMREMGenerator cube map from sky shader | Specular reflections on metal, subtle indirect fill | 1 |
| Equipment glow | Point (optional) | Active reactor glow, furnace light, alarm flash | 0–5 |

**Environment map generation:**

```javascript
// Sky scene: just the procedural sky shader on a sphere
const skyScene = new THREE.Scene();
skyScene.add(skySphere);  // fullscreen sphere with sky shader

const pmremGenerator = new THREE.PMREMGenerator(renderer3d);

function updateEnvironmentMap() {
  // Update sky shader uniforms for current time
  skyMaterial.uniforms.sunPosition.value.copy(getSunDir(TimeClock.t));
  skyMaterial.uniforms.planetColors.value.copy(getPlanetPalette());

  // Render to small cube map (64×64 faces)
  const envMap = pmremGenerator.fromScene(skyScene, 0.04);
  scene3d.environment = envMap.texture;

  // Clean up previous
  if (prevEnvMap) prevEnvMap.dispose();
  prevEnvMap = envMap;
}
```

Re-rendered when time-of-day changes significantly (every ~10
game-minutes, not every frame). Cost: one render pass of a simple
shader to a 64×64 cube map — negligible.

**Result per planet:**

| Planet | Sky reflection | Ground bounce | Sun color | Mood |
|---|---|---|---|---|
| Planet X | Purple-orange gradient | Warm brown | Amber-orange | Alien dusk |
| Mars | Salmon-pink haze | Rust red | White-yellow, small | Harsh isolation |
| Titan | Orange murk, no sun | Dark brown | Diffuse glow | Oppressive |
| Venus | Yellow-grey overcast | Pale rock | Hidden | Acid haze |
| Earth | Blue gradient, clouds | Green-brown | Warm white | Familiar |

**Why this beats point sources:**

Point sources alone make metal look like grey plastic — there's
nothing in the environment to reflect. The environment map means
a steel tank on Planet X subtly reflects purple sky on its upper
surface and warm ground on its lower surface. That's the visual
cue that says "you're on an alien world" without any explicit
environment art.

### 9.4 Shadow Configuration

Single cascaded shadow map on the directional (sun) light:

```javascript
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
sunLight.shadow.bias = -0.001;
```

Equipment casts shadows. Pipes cast shadows. Terrain receives
shadows. The hangar casts a large shadow that frames the plant.
Shadow softness from PCFSoftShadowMap.

Night: sun drops below horizon, shadow fades, point lights from
equipment become dominant. The transition is driven by sun
position — no manual switching.

---

## 10. Dual-View Synchronization

### 10.1 Creation Sync

| Action in 3D | Flowsheet response |
|---|---|
| Place unit | Auto-create block at next free position |
| Delete unit | Remove block and connections |
| Connect pipe | Draw connection line (ignoring waypoints) |
| Delete pipe | Remove connection line |

| Action in flowsheet | 3D response |
|---|---|
| Delete unit | Remove 3D model, free grid cells |
| Delete connection | Remove 3D pipe, free grid cells |
| Create connection | Create pipe with default straight route |
| Move block | No 3D change (flowsheet layout is independent) |
| Place unit | Create 3D model at next free grid position |

### 10.2 Coordinate Independence

Each unit has independent 2D and 3D coordinates. Moving a block
in the flowsheet does not move equipment in 3D. Moving equipment
in 3D does not move the flowsheet block. They share identity (id),
state (params, inventory), and topology (connections) — not position.

### 10.3 State Sync

Both views read the same simulation state. After each solve or
tick, both views update:

```javascript
function afterSolve(solveResult) {
  // Update flowsheet (existing)
  renderFlowsheet(scene, solveResult);

  // Update 3D (new)
  if (view3dActive) {
    update3DState(scene3d, scene, solveResult);
    applyColorMode(scene3d, currentColorMode, scene.runtime);
  }
}
```

The 3D update is skipped when the flowsheet is active (and vice
versa) for performance. On toggle, the active view does a full
refresh from current state.

---

## 11. Visual Feedback in 3D

### 11.1 Equipment State Indicators

| State | Visual |
|---|---|
| Normal operation | Default material color |
| Alarm (WARNING) | Yellow pulsing outline |
| Alarm (MAJOR) | Orange pulsing outline |
| Alarm (CATASTROPHIC) | Red flash + shake |
| Fried/destroyed | Charred material, smoke particles, cracks |
| Tank level | Transparent body with colored fill level |
| Active flow | Pipe interior glow/pulse in flow direction |

### 11.2 Flow Direction

Pipes show flow direction via animated dash pattern or moving
glow pulse along the pipe length. Speed proportional to flow
rate. Reversible — if flow reverses (backflow), animation
reverses.

### 11.3 Particle Effects (Minimal)

| Effect | Trigger | Implementation |
|---|---|---|
| Steam/gas vent | Relief valve active | Small particle emitter at vent port |
| Smoke | Fried equipment | Dark particle emitter, slow rise |
| Liquid overflow | Overflow active | Drip particles at overflow port |

Maximum ~200 particles on screen. Simple billboard quads. No
physics simulation on particles — just spawn, drift upward, fade.

---

## 12. Performance Budget

| Element | Draw calls | Notes |
|---|---|---|
| Terrain | 1 | Single merged mesh |
| Sky | 1 | Fullscreen sphere shader |
| Environment map | 0 | Pre-rendered to cube, used as uniform |
| Hangar | 1 | Merged shell + ribs + damage |
| Surroundings (mountains, rocks, debris) | 3 | Merged per category |
| Equipment (30 units) | 30 | Merged geometry per unit |
| Pipes (50 connections) | 50 | Merged segments per connection |
| Grid | 1 | Single line mesh |
| Particles | 1 | Instanced billboard batch |
| Shadows | ~35 | Shadow pass for equipment + hangar |
| Fog | 0 | Scene-level, no extra draw |
| **Total** | **~125** | Well within budget |

Target: 60 fps on integrated laptop GPU. Three.js with WebGL2.
Env map re-render: once per ~10 game-minutes, not per frame.
No post-processing in first version. FXAA if needed later.

Split mode doubles the visible render work but the flowsheet
side (SVG) is not a WebGL cost — only DOM reflow. Acceptable.

---

## 13. Three.js Integration

### 13.1 Single File Constraint

Three.js loaded from CDN (same as existing pattern for other
libraries in artifacts):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

All custom code (mesh generators, material shaders, camera
controls, grid system) is inline JavaScript in the HTML file.
No modules, no build step.

### 13.2 Renderer Setup

```javascript
const renderer3d = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false
});
renderer3d.shadowMap.enabled = true;
renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;

const scene3d = new THREE.Scene();
const camera3d = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
```

Canvas element sits in same container hierarchy as the SVG
flowsheet. Toggle switches `display: none` between them.

### 13.3 Render Loop

```javascript
function animate3d() {
  if (!view3dActive) return;
  requestAnimationFrame(animate3d);

  // Update time-driven elements
  updateSky(TimeClock.t);
  updateParticles(dt);
  updateFlowAnimations(dt);

  renderer3d.render(scene3d, camera3d);
}
```

The render loop only runs when the 3D view is active.
Flowsheet view uses no animation frame — it renders on
demand (after solve, after edit).

---

## 14. Export/Import

### 14.1 Extended Save Format

3D data adds minimal overhead to saved scenes:

```javascript
// Per unit (new fields):
unitData.x3d = u.x3d;
unitData.z3d = u.z3d;
unitData.rot3d = u.rot3d;

// Per connection (new field):
connData.waypoints = conn.waypoints || null;
```

No visual definitions are saved — they're in the unit registry
and regenerated at load time. Only positions and routing.

### 14.2 Legacy Import

Scenes saved before S-3D have no 3D coordinates or waypoints.
On import:
- Auto-assign grid positions (pack equipment left-to-right)
- Connections get no waypoints (default straight route)
- Player can rearrange in 3D after import

---

## 15. Implementation Phases

### S-3D-0: Editor Tool (separate HTML file)

```
[ ] Three.js canvas with orbit camera and grid ground
[ ] Primitive generators (cylinder, box, cone, sphere, hemisphere, torus)
[ ] Body composition: add/remove primitives with position sliders
[ ] Procedural material shader with uniform sliders
[ ] Material presets (steel, painted, insulated, cast iron, copper)
[ ] Detail generators: flanges, stiffeners, legs, gauges, nameplate
[ ] Port position editor (side + height, visual markers)
[ ] JSON export (copy to clipboard)
[ ] Live preview: all changes instant
```

Deliverable: standalone editor.html that produces visual
definition JSON for any unit type.

### S-3D-1: 3D World Foundation (in processThis.html)

```
[ ] Three.js renderer + scene + camera setup
[ ] View layout: toggle mode (Tab key to switch 3D ↔ flowsheet)
[ ] View layout: split mode (side-by-side, draggable divider)
[ ] View mode selector in toolbar: [3D] [Split] [Flow]
[ ] Grid system: ground grid rendering, cell occupancy tracker
[ ] Procedural terrain (per-planet noise displacement + color)
[ ] Procedural sky shader (per-planet, time-driven)
[ ] Environment map: PMREMGenerator from sky shader (64×64 cube)
[ ] Directional sun (time-driven position + color) + shadow map
[ ] Hemisphere light (planet-tinted sky/ground)
[ ] Fog (per-planet color + density)
[ ] Crashed hangar: arch shell + ribs + crash damage + debris
[ ] Hangar grid footprint (reserved cells, interior placeable)
[ ] Surroundings: distant mountains, rock formations, crash furrow
[ ] Unit mesh generation from visual definitions in registry
[ ] Equipment placement on grid (palette → ghost → click → place)
[ ] Equipment deletion (free grid cells)
[ ] Equipment rotation (R key: 90° increments)
[ ] Dual coordinates: x3d/z3d/rot3d + existing x/y flowsheet
[ ] Flowsheet auto-creates block on 3D placement
[ ] Performance: merged geometry per unit
[ ] Camera: orbit controls, zoom clamp, auto-target
[ ] Camera presets: top-down, iso, ground-level, fit-all
```

### S-3D-2: Pipe Routing + Sync

```
[ ] Pipe routing mode: click port → click waypoints → click port
[ ] Axis-aligned segment constraint
[ ] Three height levels with snap
[ ] Grid cell collision check (equipment + existing pipes)
[ ] Rejection feedback (red flash on invalid placement)
[ ] Pipe rendering: cylinders + elbow spheres
[ ] Pipe deletion
[ ] Inline equipment placement (valve on pipe segment)
[ ] Connection graph sync: 3D ↔ flowsheet
[ ] Default route generation for flowsheet-created connections
[ ] Legacy import: auto-assign 3D positions
[ ] Waypoints in export/import
```

### S-3D-3: Visual Polish + Color

```
[ ] Simulation-driven coloring (temperature, pressure, composition)
[ ] Color mode toggle (shared with flowsheet)
[ ] Tank level visualization (transparent body + fill)
[ ] Flow direction animation on pipes
[ ] Alarm visual indicators (outline pulse, color)
[ ] Fried equipment visual (charred material)
[ ] Particle effects: vent steam, overflow drip, smoke
[ ] Camera presets hotkeys (1-2-3-0)
[ ] Equipment state indicators
[ ] Environment map refresh on significant time change
[ ] Night transition: sun below horizon, equipment point lights dominant
[ ] Hangar interior lighting (warm point lights)
[ ] Performance pass: verify 60fps at 30 units + 50 pipes
[ ] Split mode: verify both views update after each solve/tick
```

---

## 16. Test Strategy

3D is primarily visual — most testing is manual/visual.
Automated tests focus on the grid and sync logic:

### Grid + Occupancy (T-3D-01 to T-3D-06)

| # | Test | Assert |
|---|---|---|
| 01 | Place unit marks grid cells | Occupied cells match footprint |
| 02 | Overlapping placement rejected | canPlaceBlock returns false |
| 03 | Delete unit frees cells | Cells available after deletion |
| 04 | Rotation swaps footprint | 2×3 unit rotated occupies 3×2 |
| 05 | Pipe segment marks cells | rasterizeSegment returns correct cells |
| 06 | Pipe through equipment rejected | canPlaceSegment returns false |

### Pipe Routing (T-3D-07 to T-3D-12)

| # | Test | Assert |
|---|---|---|
| 07 | Axis-aligned constraint | Diagonal waypoint rejected |
| 08 | Pipe through existing pipe rejected | Overlapping cells detected |
| 09 | Pipe at different height levels passes | Same XZ, different Y = OK |
| 10 | Connection creates valid graph edge | from/to in connection array |
| 11 | Delete pipe frees cells + removes connection | Clean removal |
| 12 | Inline valve splits connection correctly | Two connections, valve between |

### Dual-View Sync (T-3D-13 to T-3D-18)

| # | Test | Assert |
|---|---|---|
| 13 | 3D placement creates flowsheet block | Unit exists in both |
| 14 | Flowsheet deletion removes 3D model | Unit gone from both + cells freed |
| 15 | 3D connection appears in flowsheet | Connection in both |
| 16 | Flowsheet connection gets default 3D route | Waypoints auto-generated |
| 17 | 3D coordinates independent of flowsheet | Moving in flowsheet doesn't affect 3D |
| 18 | Export/import preserves 3D coordinates | Round-trip x3d, z3d, rot3d, waypoints |

### Mesh Generation (T-3D-19 to T-3D-22)

| # | Test | Assert |
|---|---|---|
| 19 | Deterministic generation | Same params → same vertex count |
| 20 | All unit types generate without error | No throws for any registry entry |
| 21 | Merged mesh is single geometry | drawCalls = 1 per unit |
| 22 | Color mode uniform update | Material uniform changes on mode switch |

22 tests total for S-3D.

---

## 17. Deferred (Not S-3D Scope)

| Topic | When |
|---|---|
| Waypoint drag-editing | Future UX pass |
| Pipe bend radius (smooth elbows vs sharp) | Future visual polish |
| Equipment animation (spinning pump, valve handle) | Future detail pass |
| LOD system (simplify distant equipment) | If performance requires |
| First-person walkthrough camera | Future immersion feature |
| Equipment placement sound effects | Art pass |
| Pipe flow sound (ambient hum) | Art pass |
| Multi-story platforms / vertical pipe racks | Future vertical expansion |
| Underwater/subterranean equipment | Titan ice mining scenario |
| Conveyor/transport belts (solids handling) | Future unit types |
| HDRI fallback (optional base64 env maps for ultra quality) | If procedural isn't enough |
| Hangar interior detail (control panels, screens, cots) | Narrative polish |
| Salvage mechanic (wreckage → usable parts) | Mission design |
| Weather particles (rain on Earth, dust on Mars, methane drizzle on Titan) | S-CLIMATE |
| Dynamic damage (new crash marks from catastrophic events) | S-SIM integration |

---

## 18. Data Size Summary

| Data | Size per instance | 30 units + 50 pipes |
|---|---|---|
| Visual definition (in registry) | ~400 bytes | ~6 KB total (all types) |
| 3D coordinates per unit | 3 numbers (12 bytes) | 360 bytes |
| Waypoints per pipe (avg 4) | ~48 bytes | 2.4 KB |
| Grid occupancy map | ~2 bytes per cell | ~8 KB max |
| **Total 3D overhead in save** | | **~3 KB** |

Compared to GLTF models: a single low-poly tank model would be
50-200 KB. The entire parametric visual system for ALL unit types
costs less than one imported model.
