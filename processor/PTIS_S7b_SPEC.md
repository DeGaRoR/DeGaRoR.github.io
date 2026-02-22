# PTIS_S7b_SPEC
## S7b — Unit Groups & Sub-Assemblies
### processThis v13.7.0 → v13.8.0 (post-S7)

---

## Overview

**What:** Blender-style node grouping for the process flowsheet. Select
units, group them into a collapsible container with auto-detected
boundary ports. Tab to navigate in/out. Name, save, and reuse groups
as templates from the palette. Campaign composites (greenhouse, human)
become locked group templates containing real, inspectable units —
replacing bespoke tick functions with transparent assemblies the player
can open and understand.

**Sub-sessions:** S7b-1 (2), S7b-2 (2) — 4 sessions total.

**Risk:** Medium. The expand-in-place overlay rendering (dimmed parent
+ expanded container + active interior) is the most complex canvas
work. Boundary port delegation and the solver invariant (groups
invisible to physics) are architecturally simple but must be tested
exhaustively. Main edge-case risk is multiConnect ports crossing
group boundaries and nested group interaction with the overlay stack.

**Dependencies:**
- S5 (scene infrastructure, canvas renderer, connection model)
- S7 (inspector hooks — groups need inspector integration for
  collapsed-state summary display)

**Required by:** S8c (greenhouse, human, room registered as locked
group templates instead of opaque composite units).

**Baseline state (post-S7):** Flat scene model. `Scene.units` is a
Map of individual units. `Scene.connections` is a flat array. No
hierarchy, no grouping, no assembly concept. Composites (greenhouse,
human) specified in S8 as single-registration units with internal
physics hidden in bespoke tick functions. ~447 tests.

**After S7b:** Group data model in scene. Canvas navigation stack
with Tab in/out. GroupTemplateRegistry with save/instantiate.
Palette "Templates" section. Locked groups for campaign composites.
Scene version bump (16 → 17, `groups` field). NNG-3 updated. ~465
tests (447 + ~18 new).

---

## Design Principles

**Groups are scene organization, not physics.** The solver never sees
a group. `solveScene()` iterates `scene.units` — a flat Map, same as
today. Connections still point unit-to-unit. Boundary ports are a
canvas-level indirection: they affect rendering and navigation, not
the tick/solve cycle. This is the foundational invariant.

**Modeled after Blender node groups.** Select → Group (Ctrl+G). The
selection collapses to a single box on the parent canvas. Tab enters
the group interior. Group Input / Group Output boundary nodes show
where external connections enter and leave. Tab returns to parent.
Breadcrumb trail shows depth. Groups can nest.

**Campaign composites are locked groups, not opaque boxes.** The
greenhouse is a reactor + separator + mixer inside a locked group.
The player can Tab in, click on each unit, read its inspector, see
the streams — but cannot rewire or delete. The teaching message:
these "advanced" systems are just the same components you've been
using. The game doesn't hide physics, it assembles it.

**Dual purpose: sub-assemblies and PFD organization.** The same
grouping mechanism serves both "save this as a reusable template"
and "collapse this section to declutter my flowsheet." No separate
frame/section concept needed.

---

## NNG Amendment

### NNG-3 — WYSIWYG (add paragraph 4)

```
Groups are a canvas-level organizational concept. A group is a named
set of units and their internal connections, displayed as a single
collapsible box with boundary ports. The solver sees through groups —
it iterates individual units and unit-to-unit connections. Groups
never affect tick ordering, stream resolution, pressure propagation,
or any computed value. A scene with groups produces identical physics
to the same scene ungrouped.
```

**Rationale:** NNG-3 defines the relationship between visual state
and physics. Groups are the one case where visual state (collapsed
box) diverges from physical state (individual units). The paragraph
makes explicit that this divergence is presentation-only.

### NNG-10 — Registries (add clause)

```
GroupTemplateRegistry follows the same register/get/all/exists
pattern. Templates are frozen on registration. Template instantiation
creates real units and real connections — the template is a blueprint,
not a runtime abstraction.
```

---

# S7b-1 — Group Data Model & Boundary Detection (2 sessions)

## S7b-1a. GroupDefinition Schema

```javascript
/**
 * A group is a named container of units within a scene.
 * It has no physics — the solver sees through it entirely.
 *
 * @typedef {Object} GroupDefinition
 * @property {string} id           - Unique within scene ('grp-1', 'grp-2')
 * @property {string} name         - User-editable label ('Sabatier Loop')
 * @property {Set<string>} unitIds - Member unit IDs
 * @property {BoundaryPort[]} boundaryPorts - Auto-detected, user-renameable
 * @property {boolean} locked      - true = inspect-only (campaign composites)
 * @property {string|null} templateId - If instantiated from a template
 * @property {string|null} parentGroupId - For nested groups (null = root)
 * @property {{x,y,w,h}} collapsedBounds - Position/size when collapsed on parent canvas
 */

/**
 * A boundary port maps a group's external interface to a real
 * unit port inside the group.
 *
 * @typedef {Object} BoundaryPort
 * @property {string} portId    - Unique within this group ('bp_in_1')
 * @property {string} label     - Display name ('Feed Gas'), user-editable
 * @property {'IN'|'OUT'} dir   - Direction from the group's perspective
 * @property {string} type      - Stream type (MATERIAL, ELECTRICAL)
 * @property {string} unitId    - The real unit inside the group
 * @property {string} unitPortId - The real port on that unit
 * @property {{x,y}} position   - Port position on collapsed group box
 */
```

## S7b-1b. Scene Schema Extension

```javascript
class Scene {
  constructor() {
    // ... existing fields ...
    this.units = new Map();
    this.connections = [];
    this._idCounter = 0;

    // [v13.8.0] Group infrastructure
    this.groups = new Map();    // groupId → GroupDefinition
    this._groupIdCounter = 0;
  }

  // ── Serialization (version 16 → 17) ──

  exportJSON() {
    const data = {
      version: 17,  // [v13.8.0] groups field added
      // ... existing fields unchanged ...
      units: [],
      connections: [],
      groups: []     // NEW: serialized group definitions
    };

    // Units: add groupId field
    for (const u of this.units.values()) {
      const unitData = {
        id: u.id, defId: u.defId, name: u.name,
        x: u.x, y: u.y, rot: u.rot, params: u.params
      };
      if (u.groupId) unitData.groupId = u.groupId;  // NEW
      if (u.sticker) unitData.sticker = u.sticker;
      if (u.inventory) unitData.inventory = u.inventory;
      data.units.push(unitData);
    }

    data.connections = [...this.connections];

    // Groups
    for (const g of this.groups.values()) {
      data.groups.push({
        id: g.id,
        name: g.name,
        unitIds: [...g.unitIds],
        boundaryPorts: g.boundaryPorts.map(bp => ({ ...bp })),
        locked: g.locked,
        templateId: g.templateId,
        parentGroupId: g.parentGroupId,
        collapsedBounds: { ...g.collapsedBounds }
      });
    }

    return JSON.stringify(data, null, 2);
  }

  importJSON(str) {
    // ... existing parse + validate ...
    // v17: import groups (backward-compatible: v16 files have no groups)
    if (Array.isArray(data.groups)) {
      for (const gData of data.groups) {
        // validate + reconstruct GroupDefinition
        // restore unit.groupId cross-references
      }
    }
  }
}
```

**Backward compatibility:** v16 scenes import with `groups = []`.
v17 scenes import into v16 engines with groups silently dropped
(unknown field). Units still exist, connections still exist — the
flat scene is always valid without groups.

## S7b-1c. Group/Ungroup Operations

```javascript
/**
 * Create a group from selected units.
 * Auto-detects boundary ports from cross-boundary connections.
 *
 * @param {Scene} scene
 * @param {Set<string>} selectedUnitIds - Units to group
 * @param {string} [name] - Optional group name
 * @returns {GroupDefinition|null} - null if < 2 units selected
 */
function createGroup(scene, selectedUnitIds, name) {
  if (selectedUnitIds.size < 2) return null;

  const groupId = `grp-${++scene._groupIdCounter}`;

  // ── Detect boundary ports ──
  const boundaryPorts = [];
  let bpCounter = 0;

  for (const conn of scene.connections) {
    const fromInside = selectedUnitIds.has(conn.from.unitId);
    const toInside   = selectedUnitIds.has(conn.to.unitId);

    if (fromInside && !toInside) {
      // Outgoing connection → OUT boundary port
      boundaryPorts.push({
        portId: `bp_out_${++bpCounter}`,
        label: conn.from.portId,  // default label = inner port name
        dir: 'OUT',
        type: getPortType(scene, conn.from),
        unitId: conn.from.unitId,
        unitPortId: conn.from.portId,
        position: null  // computed by layout
      });
    }
    else if (!fromInside && toInside) {
      // Incoming connection → IN boundary port
      boundaryPorts.push({
        portId: `bp_in_${++bpCounter}`,
        label: conn.to.portId,
        dir: 'IN',
        type: getPortType(scene, conn.to),
        unitId: conn.to.unitId,
        unitPortId: conn.to.portId,
        position: null
      });
    }
    // Both inside → internal (no boundary port)
    // Both outside → impossible (not our connection)
  }

  // ── Compute collapsed bounds from member bounding box ──
  const bounds = computeBoundingBox(scene, selectedUnitIds);

  const group = {
    id: groupId,
    name: name || `Group ${scene._groupIdCounter}`,
    unitIds: new Set(selectedUnitIds),
    boundaryPorts,
    locked: false,
    templateId: null,
    parentGroupId: null,  // TODO: detect if all selected are in same parent
    collapsedBounds: bounds
  };

  // ── Assign membership ──
  for (const uid of selectedUnitIds) {
    const u = scene.units.get(uid);
    if (u) u.groupId = groupId;
  }

  scene.groups.set(groupId, group);

  // ── Layout boundary port positions ──
  layoutBoundaryPorts(group);

  return group;
}

/**
 * Dissolve a group, returning units to the parent level.
 * Connections are preserved — they still point unit-to-unit.
 */
function ungroupGroup(scene, groupId) {
  const group = scene.groups.get(groupId);
  if (!group) return false;
  if (group.locked) return false;  // Cannot ungroup locked composites

  for (const uid of group.unitIds) {
    const u = scene.units.get(uid);
    if (u) u.groupId = group.parentGroupId || null;
  }

  scene.groups.delete(groupId);
  return true;
}
```

## S7b-1d. Boundary Port Layout

Boundary ports are positioned on the collapsed group box edges.
IN ports on the left edge, OUT ports on the right edge, distributed
vertically with even spacing. Electrical ports on the bottom. Same
convention as individual unit port layout.

```javascript
function layoutBoundaryPorts(group) {
  const { x, y, w, h } = group.collapsedBounds;
  const ins  = group.boundaryPorts.filter(bp => bp.dir === 'IN');
  const outs = group.boundaryPorts.filter(bp => bp.dir === 'OUT');

  // IN ports: left edge, distributed vertically
  ins.forEach((bp, i) => {
    bp.position = { x: 0, y: Math.round((i + 1) * h / (ins.length + 1)) };
  });

  // OUT ports: right edge, distributed vertically
  outs.forEach((bp, i) => {
    bp.position = { x: w, y: Math.round((i + 1) * h / (outs.length + 1)) };
  });
}
```

## S7b-1e. Connection Indirection

The solver never sees boundary ports. Under the hood, connections
always point to real unit ports. The canvas renderer translates
between boundary port positions and real connection endpoints when
the group is collapsed.

```javascript
/**
 * Get the visual endpoint for a connection at render time.
 * If the unit is inside a collapsed group, return the group's
 * boundary port position instead of the unit's actual position.
 *
 * @returns {{ x, y, unitId, portId, isGroup }}
 */
function resolveConnectionEndpoint(scene, endpoint, navigationStack) {
  const unit = scene.units.get(endpoint.unitId);
  if (!unit || !unit.groupId) return null;  // direct — no indirection

  const group = scene.groups.get(unit.groupId);
  if (!group) return null;

  // If we're currently navigated INSIDE this group, render directly
  const currentLevel = navigationStack[navigationStack.length - 1];
  if (currentLevel === group.id) return null;  // no indirection needed

  // Group is collapsed — find the boundary port for this connection
  const bp = group.boundaryPorts.find(
    bp => bp.unitId === endpoint.unitId && bp.unitPortId === endpoint.portId
  );
  if (!bp) return null;

  return {
    x: group.collapsedBounds.x + bp.position.x,
    y: group.collapsedBounds.y + bp.position.y,
    unitId: group.id,  // visual target is the group box
    portId: bp.portId,
    isGroup: true
  };
}
```

**Critical invariant:** `scene.connections` never changes when
grouping or ungrouping. Connections always store real unit IDs and
real port IDs. The indirection exists only in the rendering layer.

## S7b-1 Tests (~6)

| # | Test | Assert |
|---|------|--------|
| 1 | createGroup with 3 units, 2 cross-boundary wires | group has 2 boundaryPorts (1 IN, 1 OUT) |
| 2 | createGroup: internal wires not promoted | connection count unchanged, boundaryPorts excludes internal |
| 3 | ungroupGroup restores unit.groupId to null | all member units have groupId === null |
| 4 | Locked group rejects ungroup | ungroupGroup returns false |
| 5 | Serialization round-trip with groups | export → import → groups restored, unit.groupId preserved |
| 6 | v16 scene imports with empty groups | scene.groups.size === 0, all units accessible |

---

# S7b-2 — Canvas, Templates & Palette (2 sessions)

## S7b-2a. Navigation Model — Contextual Overlay

**Design problem:** Blender's full-replacement Tab model works for
node editors because node trees are abstract. Flowsheets are spatial
— the player needs to see where the group sits in the process. Full
isolation is disorienting: "where am I? what's upstream? what's
downstream?"

**Solution: expand-in-place overlay.** When the player enters a
group, the group box expands on the canvas to reveal its internal
units. The parent canvas remains visible but dims to ~30% opacity
and becomes non-interactive. The expanded group has a clear border,
a header bar with the group name and a close button (×), and the
boundary nodes are visible at the edges — directly aligned with
the external wires that connect to them (which are visible as
dimmed lines on the parent canvas).

Visual model:
```
┌─────────────────────────────────────────────────┐
│  Parent canvas (dimmed, non-interactive)         │
│                                                  │
│     [source]──────┐                              │
│                   │                              │
│   ┌───────────────▼──────────────────────┐       │
│   │ ✕  Sabatier Loop                     │       │
│   │ ┌─────────┐                          │       │
│   │ │ Group   │   [reactor]──[cooler]──┐ │       │
│   │ │ Input   │──▶              ┌──────┤ │       │
│   │ │ ·Feed   │   [heater]─────┘      ││ │       │
│   │ └─────────┘              ┌────────┐│ │       │
│   │                          │ Group  ││ │       │
│   │                          │ Output ├┘ │       │
│   │                          │ ·Prod  │  │       │
│   │                          └────────┘  │       │
│   └──────────────────────────────────────┘       │
│                              │                   │
│                              ▼                   │
│                         [tank]                   │
└─────────────────────────────────────────────────┘
```

The player sees:
- The internal units, fully interactive (or read-only if locked)
- The boundary Input/Output nodes at the edges
- The dimmed parent canvas showing spatial context
- The dimmed external wires connecting to the group's boundary ports
- A clear visual container with a close button

**Exiting:** Three equivalent ways, all always available:
1. Click the × button on the group header
2. Click anywhere on the dimmed parent canvas
3. Press Escape (or Tab with nothing selected)

**Entering:** Three equivalent ways:
1. Double-click the collapsed group box
2. Right-click → "Open Group" in context menu
3. Ctrl+G (keyboard shortcut, Blender convention)

**Principle: nothing is keyboard-only.** Every action has a direct
click/touch equivalent. Keyboard shortcuts are accelerators, not
gates.

```javascript
/**
 * Canvas navigation context.
 * Expand-in-place model: parent canvas dims but remains visible.
 *
 * Stack model:
 *   [null]                    → root level
 *   [null, 'grp-1']          → inside grp-1, parent dimmed
 *   [null, 'grp-1', 'grp-3'] → nested: grp-1 dimmed, grp-3 expanded
 */
const CanvasNav = {
  stack: [null],  // null = scene root

  current() {
    return this.stack[this.stack.length - 1];
  },

  isInGroup() {
    return this.stack.length > 1;
  },

  /** Enter a group — expand in place */
  enter(groupId) {
    const group = scene.groups.get(groupId);
    if (!group) return;
    this.stack.push(groupId);
    // Compute expanded bounds (larger than collapsed, centered on same position)
    this._computeExpandedLayout(group);
    canvasRedraw();
  },

  /** Exit current group — collapse back */
  exit() {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    canvasRedraw();
  },

  /** Jump to specific depth (breadcrumb click) */
  jumpTo(depth) {
    this.stack.length = depth + 1;
    canvasRedraw();
  },

  /** Compute expanded layout for group interior */
  _computeExpandedLayout(group) {
    // Expanded size = bounding box of internal units + padding
    // Centered on collapsed position, clamped to canvas bounds
    // Stored on group._expandedBounds (transient, not serialized)
  },

  /** Which units render at full opacity? */
  getActiveUnits(scene) {
    const level = this.current();
    if (level === null) {
      return [...scene.units.values()].filter(u => !u.groupId);
    }
    const group = scene.groups.get(level);
    if (!group) return [];
    return [...group.unitIds].map(id => scene.units.get(id)).filter(Boolean);
  },

  /** Which units render dimmed (parent context)? */
  getDimmedUnits(scene) {
    if (this.stack.length <= 1) return [];  // at root, nothing dimmed
    // Return all units NOT in the current group
    const currentGroup = scene.groups.get(this.current());
    if (!currentGroup) return [];
    return [...scene.units.values()].filter(u =>
      !currentGroup.unitIds.has(u.id)
    );
  },

  /** Which groups appear as collapsed boxes at this level? */
  getVisibleGroups(scene) {
    const level = this.current();
    return [...scene.groups.values()].filter(
      g => g.parentGroupId === level && g.id !== this.current()
    );
  },

  /** Breadcrumb trail for header bar */
  getBreadcrumbs(scene) {
    return this.stack.map((id, i) => ({
      label: id === null ? 'Root' : (scene.groups.get(id)?.name || id),
      depth: i
    }));
  }
};
```

### Input Handling in Overlay Mode

When inside a group:

| Target | Interaction | Result |
|--------|------------|--------|
| Active unit (inside group) | Click | Select, open inspector |
| Active unit (inside group) | Drag | Move (if not locked) |
| Active connection (inside) | Click | Select |
| Dimmed parent canvas | Click anywhere | Exit group (collapse) |
| Group header × button | Click | Exit group (collapse) |
| Breadcrumb segment | Click | Jump to that depth |
| Escape key | Press | Exit group |
| Ctrl+G on selected units inside | Press | Create nested sub-group |

Dimmed units and connections are non-interactive — clicks on them
trigger the "exit group" behavior, not selection. This prevents
accidental edits to parent-level equipment while working inside a
group.

## S7b-2b. Collapsed Group Rendering

When a group is collapsed (viewed from its parent level), it renders
as a single rectangular box:

```javascript
function renderCollapsedGroup(ctx, group, scene, tile) {
  const { x, y, w, h } = group.collapsedBounds;
  const px = x * tile, py = y * tile;
  const pw = w * tile, ph = h * tile;

  // ── Box ──
  ctx.fillStyle = group.locked ? '#1a2a3a' : '#1c2333';
  ctx.strokeStyle = group.locked ? '#58a6ff' : '#8b949e';
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 8);
  ctx.fill();
  ctx.stroke();

  // ── Lock icon (campaign composites) ──
  if (group.locked) {
    drawLockIcon(ctx, px + 6, py + 6);
  }

  // ── Name ──
  ctx.fillStyle = '#e6edf3';
  ctx.font = '600 13px -apple-system, sans-serif';
  ctx.fillText(group.name, px + (group.locked ? 22 : 8), py + 18);

  // ── Boundary ports ──
  for (const bp of group.boundaryPorts) {
    const bpx = px + bp.position.x * tile;
    const bpy = py + bp.position.y * tile;
    drawPort(ctx, bpx, bpy, bp.type, bp.dir);

    // Port label
    ctx.fillStyle = '#8b949e';
    ctx.font = '10px -apple-system, sans-serif';
    const labelX = bp.dir === 'IN' ? bpx + 10 : bpx - 10;
    const align = bp.dir === 'IN' ? 'left' : 'right';
    ctx.textAlign = align;
    ctx.fillText(bp.label, labelX, bpy + 4);
    ctx.textAlign = 'left';
  }

  // ── Worst alarm severity badge ──
  const worstAlarm = getWorstAlarmInGroup(group, scene);
  if (worstAlarm && worstAlarm.severity !== 'OK') {
    drawAlarmBadge(ctx, px + pw - 8, py + 8, worstAlarm.severity);
  }

  // ── Unit count ──
  ctx.fillStyle = '#484f58';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText(`${group.unitIds.size} units`, px + 8, py + ph - 8);
}
```

## S7b-2c. Overlay Rendering

When navigated inside a group, the canvas renders three layers:

1. **Dimmed parent layer** — all parent-level units and connections
   at 30% opacity. Non-interactive. Provides spatial context.
2. **Expanded group container** — bordered rectangle with header bar,
   at the group's position but expanded to fit internal units.
3. **Active interior layer** — member units rendered normally inside
   the container. Fully interactive (or read-only if locked).

```javascript
function renderGroupOverlay(ctx, group, scene, tile) {
  // ── Layer 1: Dimmed parent context ──
  ctx.save();
  ctx.globalAlpha = 0.3;
  for (const u of CanvasNav.getDimmedUnits(scene)) {
    renderUnit(ctx, u, scene, tile, { dimmed: true });
  }
  for (const conn of scene.connections) {
    // Render parent-level connections dimmed
    const fromIn = group.unitIds.has(conn.from.unitId);
    const toIn = group.unitIds.has(conn.to.unitId);
    if (!fromIn && !toIn) {
      renderConnection(ctx, conn, scene, tile, { dimmed: true });
    }
  }
  ctx.restore();

  // ── Semi-transparent scrim over parent ──
  ctx.fillStyle = 'rgba(13, 17, 23, 0.5)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // ── Layer 2: Expanded group container ──
  const eb = group._expandedBounds;  // transient, computed on enter
  const px = eb.x * tile, py = eb.y * tile;
  const pw = eb.w * tile, ph = eb.h * tile;

  // Container background
  ctx.fillStyle = '#0d1117';
  ctx.strokeStyle = group.locked ? '#58a6ff' : '#8b949e';
  ctx.lineWidth = 2;
  roundRect(ctx, px, py - 28, pw, ph + 28, 8);
  ctx.fill();
  ctx.stroke();

  // ── Header bar ──
  ctx.fillStyle = '#161b22';
  roundRectTop(ctx, px, py - 28, pw, 28, 8);
  ctx.fill();

  // Group name
  ctx.fillStyle = '#e6edf3';
  ctx.font = '600 12px -apple-system, sans-serif';
  ctx.fillText(group.name, px + 12, py - 10);

  // Lock icon (campaign composites)
  if (group.locked) {
    drawLockIcon(ctx, px + pw - 40, py - 22);
  }

  // Close button (×)
  ctx.fillStyle = '#8b949e';
  ctx.font = '16px -apple-system, sans-serif';
  ctx.fillText('×', px + pw - 18, py - 9);
  // Register click target for close button
  registerClickTarget('group_close', { x: px + pw - 24, y: py - 28, w: 24, h: 28 });

  // ── Layer 3: Internal units and connections ──
  // Boundary Input node (left edge of container)
  const inPorts = group.boundaryPorts.filter(bp => bp.dir === 'IN');
  if (inPorts.length > 0) {
    renderBoundaryNode(ctx, 'Input', inPorts, px, py, ph, 'left', tile);
  }

  // Boundary Output node (right edge of container)
  const outPorts = group.boundaryPorts.filter(bp => bp.dir === 'OUT');
  if (outPorts.length > 0) {
    renderBoundaryNode(ctx, 'Output', outPorts, px + pw, py, ph, 'right', tile);
  }

  // Member units (fully interactive or locked-readonly)
  for (const uid of group.unitIds) {
    const u = scene.units.get(uid);
    if (!u) continue;
    renderUnit(ctx, u, scene, tile, { locked: group.locked });
  }

  // Internal connections
  for (const conn of scene.connections) {
    const fromIn = group.unitIds.has(conn.from.unitId);
    const toIn = group.unitIds.has(conn.to.unitId);
    if (fromIn && toIn) {
      renderConnection(ctx, conn, scene, tile);
    }
  }

  // Cross-boundary connections (from boundary node to internal unit)
  for (const bp of group.boundaryPorts) {
    renderBoundaryWire(ctx, bp, scene, tile);
  }

  // ── Worst alarm severity badge in header ──
  const worstAlarm = getWorstAlarmInGroup(group, scene);
  if (worstAlarm && worstAlarm.severity !== 'OK') {
    drawAlarmBadge(ctx, px + pw - 60, py - 22, worstAlarm.severity);
  }
}
```

**Locked group overlay:** When `group.locked === true`, the overlay
renders identically but interaction is mostly read-only:
- Clicking a unit opens its inspector
- Parameters listed in `editableParams` have active controls
  (e.g., greenhouse lighting efficiency)
- All other parameters are greyed out, values visible but not
  editable
- Stream conditions, temperatures, compositions fully visible
- Drag, delete, connect, disconnect all rejected
- Toast on structural edit attempt: "This is a pre-built assembly"
- The teaching value is that the player SEES real physics and can
  tune exposed parameters — but can't rewire

## S7b-2d. GroupTemplateRegistry

```javascript
/**
 * Registry for reusable group templates.
 * Campaign composites are registered here.
 * User-created templates are saved here.
 *
 * A template is a blueprint — instantiation creates real units
 * and real connections. The template itself is frozen pure data.
 */
const GroupTemplateRegistry = {
  _templates: new Map(),

  /**
   * Register a group template.
   * @param {string} id - Template ID ('greenhouse', 'user_sabatier_loop')
   * @param {Object} def - Template definition
   */
  register(id, def) {
    // Validate: all defIds exist in UnitRegistry
    for (const unitDef of def.units) {
      if (!UnitRegistry.exists(unitDef.defId)) {
        throw new Error(`GroupTemplate '${id}': unknown defId '${unitDef.defId}'`);
      }
    }

    // Validate: boundary port delegates exist
    for (const bp of def.boundaryPorts) {
      const target = def.units.find(u => u.localId === bp.unitLocalId);
      if (!target) {
        throw new Error(`GroupTemplate '${id}': boundary port '${bp.portId}' delegates to unknown unit '${bp.unitLocalId}'`);
      }
    }

    // Validate: internal connections reference valid local IDs and ports
    for (const conn of def.connections) {
      // ... validate from/to local IDs and port existence ...
    }

    Object.freeze(def);
    Object.freeze(def.units);
    Object.freeze(def.boundaryPorts);
    Object.freeze(def.connections);
    this._templates.set(id, def);
  },

  get(id) { return this._templates.get(id); },
  exists(id) { return this._templates.has(id); },
  all() { return [...this._templates.values()]; },

  /** Templates available for palette display */
  getPaletteEntries() {
    return this.all().filter(t => t.showInPalette);
  }
};
```

**Template definition schema:**

```javascript
/**
 * @typedef {Object} GroupTemplate
 * @property {string} id          - Unique template ID
 * @property {string} name        - Display name ('Greenhouse')
 * @property {string} category    - Palette category ('CAMPAIGN'|'USER'|'BUILTIN')
 * @property {boolean} locked     - Instances are locked (campaign composites)
 * @property {boolean} showInPalette - Appears in palette
 * @property {number} w           - Collapsed footprint width (grid cells)
 * @property {number} h           - Collapsed footprint height (grid cells)
 * @property {TemplateUnit[]} units - Internal units (local IDs)
 * @property {TemplateConnection[]} connections - Internal wiring
 * @property {TemplateBoundaryPort[]} boundaryPorts - External interface
 * @property {Object} [paramOverrides] - Default params applied to internal units
 */

/**
 * @typedef {Object} TemplateUnit
 * @property {string} localId     - ID within template ('photo_reactor')
 * @property {string} defId       - UnitRegistry defId
 * @property {number} x           - Relative x within group
 * @property {number} y           - Relative y within group
 * @property {Object} params      - Default parameters
 * @property {boolean} paramLocked - All params locked (campaign composites)
 * @property {string[]|null} editableParams - If non-null, only these
 *   params are editable even in a locked group. All others greyed out
 *   in inspector. null = all locked (default for locked groups).
 */

/**
 * @typedef {Object} TemplateBoundaryPort
 * @property {string} portId      - Port ID on the group box
 * @property {string} label       - Display label
 * @property {'IN'|'OUT'} dir     - Direction
 * @property {string} type        - Stream type
 * @property {string} unitLocalId - Which internal unit this delegates to
 * @property {string} unitPortId  - Which port on that unit
 */
```

## S7b-2e. Template Instantiation

```javascript
/**
 * Instantiate a group template into the scene.
 * Creates real units, real connections, and a group wrapper.
 *
 * @param {Scene} scene
 * @param {string} templateId
 * @param {number} x, y - Placement position on canvas
 * @returns {GroupDefinition|null}
 */
function instantiateTemplate(scene, templateId, x, y) {
  const template = GroupTemplateRegistry.get(templateId);
  if (!template) return null;

  // ── Create real units with scene-unique IDs ──
  const localToSceneId = new Map();

  for (const tUnit of template.units) {
    const sceneId = scene.placeUnit(
      tUnit.defId,
      x + tUnit.x,
      y + tUnit.y
    );
    if (!sceneId) continue;  // collision — handle gracefully

    localToSceneId.set(tUnit.localId, sceneId);

    // Apply template params
    const unit = scene.units.get(sceneId);
    if (unit && tUnit.params) {
      Object.assign(unit.params, tUnit.params);
    }
  }

  // ── Create internal connections ──
  for (const tConn of template.connections) {
    const fromId = localToSceneId.get(tConn.from.localId);
    const toId   = localToSceneId.get(tConn.to.localId);
    if (fromId && toId) {
      scene.connect(
        { unitId: fromId, portId: tConn.from.portId },
        { unitId: toId,   portId: tConn.to.portId }
      );
    }
  }

  // ── Create group ──
  const sceneUnitIds = new Set(localToSceneId.values());
  const group = createGroup(scene, sceneUnitIds, template.name);
  if (group) {
    group.locked = template.locked;
    group.templateId = template.id;

    // Override auto-detected boundary ports with template's labeled ports
    group.boundaryPorts = template.boundaryPorts.map(tbp => ({
      portId: tbp.portId,
      label: tbp.label,
      dir: tbp.dir,
      type: tbp.type,
      unitId: localToSceneId.get(tbp.unitLocalId),
      unitPortId: tbp.unitPortId,
      position: null  // computed by layout
    }));
    layoutBoundaryPorts(group);

    // Set collapsed bounds from template footprint
    group.collapsedBounds = { x, y, w: template.w, h: template.h };
  }

  return group;
}
```

## S7b-2f. Saving User Templates

```javascript
/**
 * Save an existing group as a reusable template.
 * Extracts the structure from the live scene.
 */
function saveGroupAsTemplate(scene, groupId, name) {
  const group = scene.groups.get(groupId);
  if (!group) return null;

  // ── Build template units with relative coordinates ──
  const bounds = group.collapsedBounds;
  const units = [];
  const sceneToLocalId = new Map();

  for (const uid of group.unitIds) {
    const u = scene.units.get(uid);
    if (!u) continue;
    const localId = u.defId + '_' + units.length;
    sceneToLocalId.set(uid, localId);
    units.push({
      localId,
      defId: u.defId,
      x: u.x - bounds.x,
      y: u.y - bounds.y,
      params: { ...u.params },
      paramLocked: false
    });
  }

  // ── Extract internal connections ──
  const connections = [];
  for (const conn of scene.connections) {
    const fromLocal = sceneToLocalId.get(conn.from.unitId);
    const toLocal   = sceneToLocalId.get(conn.to.unitId);
    if (fromLocal && toLocal) {
      connections.push({
        from: { localId: fromLocal, portId: conn.from.portId },
        to:   { localId: toLocal,   portId: conn.to.portId }
      });
    }
  }

  // ── Map boundary ports ──
  const boundaryPorts = group.boundaryPorts.map(bp => ({
    portId: bp.portId,
    label: bp.label,
    dir: bp.dir,
    type: bp.type,
    unitLocalId: sceneToLocalId.get(bp.unitId),
    unitPortId: bp.unitPortId
  }));

  const templateId = `user_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

  const template = {
    id: templateId,
    name,
    category: 'USER',
    locked: false,
    showInPalette: true,
    w: bounds.w,
    h: bounds.h,
    units,
    connections,
    boundaryPorts
  };

  GroupTemplateRegistry.register(templateId, template);
  return templateId;
}
```

**Persistence:** User templates are serialized alongside the scene
in `exportJSON()` via a `userTemplates` array. On import, they are
re-registered in `GroupTemplateRegistry`. Campaign templates are
registered at startup and do not need persistence.

```javascript
// In exportJSON():
data.userTemplates = GroupTemplateRegistry.all()
  .filter(t => t.category === 'USER')
  .map(t => ({ ...t }));

// In importJSON():
if (Array.isArray(data.userTemplates)) {
  for (const t of data.userTemplates) {
    GroupTemplateRegistry.register(t.id, t);
  }
}
```

## S7b-2g. Palette Integration

The palette toolbar gains a "Templates" section below the standard
equipment categories:

```javascript
function buildPaletteEntries(gameMode, campaignState) {
  const entries = [];

  // ── Standard equipment (existing logic) ──
  // ... existing palette building ...

  // ── Templates section ──
  const templates = GroupTemplateRegistry.getPaletteEntries();

  // Campaign templates (locked composites)
  const campaign = templates.filter(t => t.category === 'CAMPAIGN');
  if (campaign.length > 0) {
    entries.push({ type: 'section', label: 'Assemblies' });
    for (const t of campaign) {
      entries.push({
        type: 'template',
        templateId: t.id,
        name: t.name,
        w: t.w,
        h: t.h,
        locked: t.locked
      });
    }
  }

  // User templates
  const user = templates.filter(t => t.category === 'USER');
  if (user.length > 0) {
    entries.push({ type: 'section', label: 'My Templates' });
    for (const t of user) {
      entries.push({
        type: 'template',
        templateId: t.id,
        name: t.name,
        w: t.w,
        h: t.h,
        locked: false
      });
    }
  }

  return entries;
}
```

**Placement:** Dragging a template from the palette calls
`instantiateTemplate()`. Same interaction as placing a unit, but
creates a group.

**Context menu on groups (right-click collapsed group box):**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Open Group | Double-click / Ctrl+G | Enter overlay view |
| Rename Group | — | Inline edit of group name |
| Save as Template | — | `saveGroupAsTemplate()` → appears in palette |
| Ungroup | Ctrl+Shift+G | Dissolve (disabled if locked) |
| Delete Group | Delete | Removes group + all member units + connections |

**Context menu on canvas background (right-click with ≥2 units
selected):**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Group Selected | Ctrl+G | Creates group from selection |

**All actions are accessible via right-click context menu.** Keyboard
shortcuts are accelerators only. Touch/mouse users never need a
keyboard to group, enter, exit, or manage groups.

## S7b-2h. Nested Groups

Groups can contain other groups. When the player selects units that
include a collapsed group box and groups them, the inner group
becomes a child (`parentGroupId` set to the new outer group).

Depth limit: 3 levels (root → group → group → group). Prevents
confusion. Enforced in `createGroup()`.

```javascript
// In createGroup():
const maxDepth = 3;
const currentDepth = getGroupDepth(scene, parentGroupId);
if (currentDepth >= maxDepth) {
  toast('Maximum nesting depth reached');
  return null;
}
```

## S7b-2i. Edge Cases — Boundary Ports & Solver Safety

Grouping creates boundary ports from cross-boundary connections.
Several edge cases need explicit handling to guarantee that grouping
never corrupts physics (NNG-3: groups never affect computed values).

### Edge 1: Unconnected internal ports

A unit inside a group may have ports that are connected neither
internally nor externally. These ports have no boundary port created
for them. They remain unconnected.

**Behavior:** Identical to an ungrouped unit with an unconnected
port. NNG-3 applies: unconnected port = zero flow, zero heat, zero
power. The solver already handles this. No special group logic
needed.

### Edge 2: Boundary port with no external connection

After grouping, the boundary port exists on the collapsed group box
but the external wire may be disconnected by the user (or may never
have existed if the group was instantiated from a template and
placed without connecting all ports).

**Behavior:** The boundary port is displayed on the group box as an
available port. Under the hood, the internal unit port it delegates
to is simply unconnected. NNG-3: zero flow. The boundary port is
visual only — it advertises "you can connect here" but creates no
phantom flow if you don't.

### Edge 3: multiConnect ports crossing the boundary

A `multiConnect` port (e.g., `elec_in` on a hub) inside a group
may have connections both to internal units AND to external units.
Both connections are real in `scene.connections`. The boundary port
delegates to the same physical port.

**Behavior:** The boundary port is created for the external
connection(s). The internal connections are just internal wires.
The solver sees all connections on the multiConnect port — both
internal and external. The collapsed group box shows the boundary
port; wires from external units connect to it. Under the hood, all
connections point to the same real unit port. Works correctly
because `scene.connections` is unchanged by grouping.

### Edge 4: Grouping units from different existing groups

If the selection spans units from two different groups, the
operation is rejected.

**Behavior:** `createGroup()` checks that all selected units share
the same `groupId` (or all have `null`). Mixed membership → toast:
"Cannot group units from different groups. Ungroup first." This
prevents tangled hierarchies.

### Edge 5: Deleting a group

Two distinct operations:
- **"Delete Group":** All member units and their connections
  (internal and external) are removed from the scene. The group is
  removed. External units that were connected to the group lose
  those connections — cleaned up by existing ghost connection
  stripping in `solveScene()`.
- **"Ungroup":** Units return to the parent level with their
  individual positions. All connections preserved. Group metadata
  removed. No physics impact.

### Edge 6: Solver invariant test

The critical invariant, tested explicitly:

```javascript
// T-GR-INVARIANT: Grouping never changes computed values
// 1. Build a scene with N units and M connections
// 2. Solve → record all stream temperatures, pressures, flows
// 3. Group a subset of units
// 4. Solve again → all values identical within tolerance
// 5. Ungroup → solve → all values identical
```

This test exists because it is the one thing that must never break.
If it fails, grouping has somehow leaked into the solver.

## S7b-2 Tests (~12)

| # | Test | Assert |
|---|------|--------|
| 1 | CanvasNav.enter/exit | stack depth changes correctly |
| 2 | getActiveUnits at root excludes grouped units | only ungrouped units returned |
| 3 | getActiveUnits inside group returns members | all member units returned |
| 4 | getDimmedUnits inside group returns parent units | non-member units returned |
| 5 | Collapsed group renders boundary ports | port count matches boundaryPorts.length |
| 6 | resolveConnectionEndpoint with collapsed group | returns group box position |
| 7 | resolveConnectionEndpoint inside group | returns null (no indirection) |
| 8 | GroupTemplateRegistry.register validates defIds | unknown defId → throws |
| 9 | instantiateTemplate creates units + connections + group | scene.units grows, group exists |
| 10 | saveGroupAsTemplate round-trip: save → instantiate | same topology |
| 11 | **T-GR-INVARIANT: group/ungroup preserves physics** | all computed values identical before and after |
| 12 | Edge: mixed group membership rejected | createGroup returns null, toast shown |

---

## S7b Impact on S8 Spec

S7b replaces the S8c "composite unit" approach. The following S8c
sections are affected:

### S8c-4 (Composite Units) — Rewritten

Instead of:
```javascript
// OLD S8 approach — opaque composite with bespoke tick
UnitRegistry.register('greenhouse', { tick: greenhouseTick, ... });
```

New approach:
```javascript
// S8c registers campaign composite templates using S7b infrastructure
GroupTemplateRegistry.register('greenhouse', {
  name: 'Greenhouse',
  category: 'CAMPAIGN',
  locked: true,
  showInPalette: true,
  w: 3, h: 3,
  units: [
    { localId: 'light_source',  defId: 'grid_supply',
      x: 0, y: 0,
      params: { maxPower: 5 },
      paramLocked: true,
      editableParams: null },
    { localId: 'photo_reactor', defId: 'reactor_electrochemical',
      x: 1, y: 0,
      params: { reaction: 'R_PHOTOSYNTHESIS', efficiency: 0.01,
                conversion_max: 0.95 },
      paramLocked: true,
      editableParams: ['efficiency'] },
    { localId: 'leaf',          defId: 'membrane_separator',
      x: 2, y: 0,
      params: { membrane: 'gas_exchange', selectivity: { O2: 0.95, H2O: 0.80 } },
      paramLocked: true,
      editableParams: null },
    { localId: 'nutrient_mix',  defId: 'mixer',
      x: 0, y: 1,
      params: {},
      paramLocked: true,
      editableParams: null }
  ],
  connections: [
    { from: { localId: 'light_source',  portId: 'out' },
      to:   { localId: 'photo_reactor', portId: 'elec_in' } },
    { from: { localId: 'photo_reactor', portId: 'mat_out' },
      to:   { localId: 'leaf',          portId: 'mat_in' } }
    // ... remaining internal wiring
  ],
  boundaryPorts: [
    { portId: 'air_in',   label: 'Air In',     dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'nutrient_mix', unitPortId: 'mat_in_A' },
    { portId: 'water_in', label: 'Water In',   dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'nutrient_mix', unitPortId: 'mat_in_B' },
    { portId: 'elec_in',  label: 'Power',      dir: 'IN',  type: 'ELECTRICAL',
      unitLocalId: 'light_source', unitPortId: 'elec_in' },
    { portId: 'air_out',  label: 'O₂-rich Air', dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'leaf',         unitPortId: 'perm_out' },
    { portId: 'food_out', label: 'Food',        dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'leaf',         unitPortId: 'ret_out' }
  ]
});
```

The player places "Greenhouse" from the palette. It appears as a
locked group box. Tab in → see the electrochemical reactor running
photosynthesis, the membrane separator acting as a leaf, the mixer
handling nutrient input. Click any unit → full read-only inspector
with real stream data: temperatures, compositions, flow rates.
The efficiency parameter on the photo_reactor is the ONE editable
control: the player can adjust lighting efficiency (0.5–5%) and
watch the power demand change in real time. At η = 1%, the
greenhouse demands ~85 kW for 7 colonists. The physics is fully
transparent — the player learns that biology is elegant but
energetically expensive.

### New Units Required (registered in S8c, not S7b)

S7b provides the grouping infrastructure. S8c registers the specific
units that live inside campaign composites:

| defId | Physical | Purpose | Trunk |
|-------|----------|---------|-------|
| `membrane_separator` | Selective membrane unit | Leaf (gas exchange), kidney (metabolic waste) | `separatorTick` (new) |

The `membrane_separator` is the "leaf" and "kidney" Denis described.
It is a real registered unit with:
- `mat_in` (feed), `perm_out` (permeate), `ret_out` (retentate)
- Params: `membrane` type, `selectivity` map (species → fraction)
- Dedicated `separatorTick` trunk (not flash_drum physics — membrane
  permeation, not VLE)
- S-size limits appropriate for biological membranes

The same `defId` serves both the greenhouse leaf (O₂/H₂O permeation)
and the human kidney (waste filtration) — different selectivity maps
via params, same physics trunk. This follows NNG-3: same machine,
different operating parameters.

### S8c-5 (Human) — Rewritten as Template

```javascript
// Metabolic rates (2500 kcal/day/person, NASA moderate activity):
//   CH₂O consumed:  0.84 mol/hr/person  (food)
//   O₂ consumed:    0.84 mol/hr/person  (1:1 stoichiometry)
//   CO₂ produced:   0.84 mol/hr/person
//   H₂O produced:   0.84 mol/hr/person  (metabolic, exhaled)
//   Water consumed:  7.0  mol/hr/person  (drinking → waste)
//   Metabolic heat:  121 W/person        (from ΔH × ξ, automatic)

GroupTemplateRegistry.register('human', {
  name: 'Colonists',
  category: 'CAMPAIGN',
  locked: true,
  showInPalette: true,
  w: 2, h: 2,
  units: [
    { localId: 'metabolism',  defId: 'reactor_equilibrium',
      x: 0, y: 0,
      params: { reaction: 'R_METABOLISM', T: 310 },
      paramLocked: true,
      editableParams: null },
    { localId: 'kidney',     defId: 'membrane_separator',
      x: 1, y: 0,
      params: { membrane: 'renal', selectivity: { H2O: 0.99, CO2: 0.05 } },
      paramLocked: true,
      editableParams: null }
  ],
  connections: [
    { from: { localId: 'metabolism', portId: 'mat_out' },
      to:   { localId: 'kidney',    portId: 'mat_in' } }
  ],
  boundaryPorts: [
    { portId: 'air_in',    label: 'Air In',    dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'metabolism', unitPortId: 'mat_in' },
    { portId: 'food_in',   label: 'Food In',   dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'metabolism', unitPortId: 'feed_in' },
    { portId: 'air_out',   label: 'Exhaled Air', dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'kidney',    unitPortId: 'perm_out' },
    { portId: 'waste_out', label: 'Waste',       dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'kidney',    unitPortId: 'ret_out' }
  ]
});
```

### S8c Room — Unchanged

The room (shelter) remains a single registered unit. It is a vessel
(large sealed tank with atmospheric tracking), not a composite. No
internal structure to expose.

---

## Tests Summary (~18 total)

| Session | Tests | Cumulative |
|---------|-------|------------|
| S7b-1a–e (data model, boundary detection, serialization) | 6 | 453 |
| S7b-2a–i (canvas, templates, palette, edge cases) | 12 | 465 |
| **Total S7b** | **~18** | **~465** |

**Gate:** All previous (447) + 18 new → 465 cumulative.

---

## Implementation Checklist

```
S7b-1 session 1 (data model + boundary detection):
  [ ] GroupDefinition schema
  [ ] Scene.groups Map + _groupIdCounter
  [ ] unit.groupId field
  [ ] createGroup() with boundary port auto-detection
  [ ] createGroup() mixed-membership rejection (Edge 4)
  [ ] ungroupGroup()
  [ ] computeBoundingBox() for collapsed bounds
  [ ] layoutBoundaryPorts() — IN left, OUT right
  [ ] Tests 1–4

S7b-1 session 2 (serialization + connection indirection):
  [ ] exportJSON version 16 → 17, groups array
  [ ] importJSON v17 groups restore + v16 backward compat
  [ ] userTemplates serialization in export/import
  [ ] resolveConnectionEndpoint() indirection layer
  [ ] NNG-3 paragraph 4 (groups are canvas-level)
  [ ] NNG-10 clause (GroupTemplateRegistry)
  [ ] Tests 5–6

S7b-2 session 1 (canvas + overlay navigation):
  [ ] CanvasNav object (stack, enter, exit, jumpTo)
  [ ] getActiveUnits() / getDimmedUnits() / getVisibleGroups()
  [ ] renderCollapsedGroup() — box, name, ports, alarm badge
  [ ] renderGroupOverlay() — dimmed parent + expanded container + active interior
  [ ] Boundary Input/Output node rendering at container edges
  [ ] Group header bar with name + close button (×)
  [ ] Dimmed parent scrim (click-to-exit)
  [ ] Enter: double-click, context menu "Open Group", Ctrl+G
  [ ] Exit: × button, click dimmed area, Escape
  [ ] Locked group: read-only inspectors, edit rejection toast
  [ ] Context menu: Open, Rename, Save as Template, Ungroup, Delete
  [ ] Tests 1–7

S7b-2 session 2 (templates + palette):
  [ ] GroupTemplateRegistry (register/get/all/exists)
  [ ] Template schema + validation + freeze
  [ ] instantiateTemplate() — units + connections + group
  [ ] saveGroupAsTemplate() — extract from live scene
  [ ] Palette 'Assemblies' / 'My Templates' sections
  [ ] Nested groups with depth limit (3)
  [ ] T-GR-INVARIANT: group/ungroup physics invariant test
  [ ] Tests 8–12
  [ ] Full regression

Total S7b: ~18 new tests → 465 cumulative
```

---

## What S7b Does NOT Do

- **No new physics.** Groups are invisible to the solver. No tick
  functions change. No computed values change.
- **No campaign content.** Greenhouse/human template registrations
  happen in S8c, not S7b. S7b provides the infrastructure only.
- **No new separator unit.** `membrane_separator` is registered in
  S8c (it's campaign content requiring R_PHOTOSYNTHESIS and
  R_METABOLISM which are also S8c).
- **No 3D view.** Groups work on the 2D SVG/canvas flowsheet.
- **No cross-scene templates.** User templates are per-scene (saved
  in exportJSON). A global template library is a post-S8 feature.

---

## What S7b Enables Downstream

| Consumer | What it uses |
|----------|-------------|
| S8c (composites) | Locked group templates for greenhouse, human. `membrane_separator` as internal unit. Player can Tab in and inspect real physics. |
| S8b (missions) | Palette `{ templateId: count }` for composite equipment scarcity. |
| S8c (save/load) | Groups preserved in scene serialization. Templates restored on load. |
| Sandbox | Player groups sections of complex PFDs. Saves reusable sub-assemblies. |
| Future | Cross-scene template library. Template sharing/export. |

---

## Dependency Map Update

```
S0 → S1 → S2 → S3 → S5 → S7 → S7b → S8a → S8b → S8c
                 ↓              ↑
                 S4 ─────────→ S7
                 ↓
                 S6 ─────────────────────────────→ S8c
```

Critical path extends by 4 sessions (S7b).

| Stage | Sessions | Cumulative |
|-------|----------|------------|
| S0–S7 (unchanged) | 26 | 447 tests |
| **S7b** | **4** | **465 tests** |
| S8a–S8c | 12 | ~495 tests |
| **Total** | **42** | **~495** |

Note: S8 test count increases from 477 to ~495 because the
greenhouse/human tests now validate template instantiation and
internal unit behavior, not just opaque composite outputs.
