# S-PARTICLES: Unified Particle System

**Version:** 3.0 — March 2026
**Status:** Design spec (pre-implementation)

---

## 1. Mental model

Two rendering layers:

```
Canvas (top)  — particles, trails, effects.  pointer-events: none.
SVG (bottom)  — units, connections, stubs, ports, stickers, grid.
```

Particles are visible only through **sight glass windows**:
- **Unit viewports** — dark recessed panels on ragtag icons
- **Pipe windows** — capsule cutaways in connection paths

```
[unit viewport] → solid stub → [pipe window] → solid stub → [unit viewport]
```

No particles on stubs. The gaps are deliberate — solid metal with
inspection windows.

---

## 2. Viewport audit

Current viewports are too small for particle animations. Key units
need enlarged viewports to become the star visual pieces.

### 2.1 Current vs proposed

| Unit | Body size | Current viewport | Proposed viewport | Ratio |
|---|---|---|---|---|
| **reactor (all 3)** | 72×68 at (12,4) | Circle r=16 at (48,36) | Circle r=26 at (48,38) | 16%→43% |
| **flash_drum** | 44×80 at (22,8) | Rect 12×52 sight strip | Rect 32×60 at (28,18) | 13%→55% |
| **reactor_electrochemical** | — | Rect 60×68 at (18,14) | OK — already large | 70% |
| **compressor** | 60×48 at (18,24) | Rect 36×32 at (28,32) | OK — adequate | 40% |
| **gas_turbine** | 60×56 | Rect 48×36 at (24,30) | OK — adequate | 51% |
| **hex** | — | Circle r=18 | Rect 52×50 at (22,23) | 20%→45% |
| **mixer** | varies | Rect in body | OK — adequate | — |
| **air_cooler** | — | Circle r=12 | Circle r=20 | 12%→34% |
| **tank** | 136×64 at (4,16) | Rect 10×52 sight strip | Phase 5 — deferred | 6% |
| **open_tank** | 116×68 at (14,14) | Rect 10×52 sight strip | Phase 5 — deferred | 6% |

### 2.2 Reactor viewport enlargement

Current: r=16 circle, 6 hardcoded bubble SVG elements inside.
Proposed: r=26, leaving 10px metal frame on all sides. Bolts move
to corners of frame. Chip and gauge stay on frame. The existing SVG
bubbles (`data-anim: reactor-bubble`) are retired — replaced by
canvas species-morph particles.

The viewport covers most of the vessel face. The player sees
reactant colors entering left, morphing through the reaction zone,
and product colors exiting right.

### 2.3 Flash drum viewport enlargement

Current: 12px wide sight glass strip with liquid level indicator.
Proposed: 32×60 rect centered in the vessel body, with rounded
corners (rx:8) for a capsule look. Tick marks and level indicator
move to the viewport's right edge (inside the window).

The viewport becomes the stage for the phase split animation — gas
particles rise to vap_out, liquid particles sink to liq_out. The
liquid level is visible as a density boundary within the viewport:
dense blobby particles below, sparse wispy particles above.

### 2.4 HEX viewport

Current: circle r=18 (too small for dual-stream visualization).
Proposed: rect 52×50, showing hot stream (top half) and cold stream
(bottom half) with a thin divider line. Two independent particle
flows visible side by side.

### 2.5 Units left opaque (deliberate)

| Unit | Why | Future |
|---|---|---|
| valve | All solid — no interior to show | Never |
| splitter | Custom S-curve geometry, all solid | Never |
| tank | Complex: gas/liquid/level inside capsule body | Phase 5 |
| open_tank | Similar complexity | Phase 5 |
| pump | Engineering theme: transparent circle casing works already | Phase 2 |
| battery | Electrical only — no material flow | Never |
| all power units | Electrical only | Never |

---

## 3. Canvas setup

### 3.1 HTML

```html
<div id="view-flowsheet" style="position: relative">
  <svg id="flowsheet">...</svg>
  <canvas id="particleCanvas"
    style="position:absolute; top:0; left:0; pointer-events:none">
  </canvas>
</div>
```

### 3.2 Coordinate sync

```javascript
function _syncCanvasTransform() {
  const vb = ui.viewBox;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const sx = canvas.width / vb.w, sy = canvas.height / vb.h;
  ctx.setTransform(sx, 0, 0, sy, -vb.x * sx, -vb.y * sy);
}
```

### 3.3 Frame loop

```
_iconAnimFrame(timestamp):
  1. Compute deltaSec
  2. Advance SVG icon animations (impellers, LEDs — unchanged)
  3. Advance all particle state
  4. Canvas: motion-blur clear (see §5.1)
  5. _syncCanvasTransform()
  6. Draw all particles to canvas
```

---

## 4. Pipe windows

Three SVG strokes on each connection Bézier:

| Layer | Width | Color | Extent |
|---|---|---|---|
| Outer wall | 9px | `#2d3748` | Full path |
| Inner bore | 6px | `#0f172a` | Full path |
| Window | 5px | `#1a2332` | 10%–90% of path |

Window sub-path via de Casteljau (`_bzSplit`). Round linecap =
capsule ends. Canvas clips particles to window shape.

Stubs: single-stroke solid. No window, no particles.

---

## 5. Canvas-native effects

These replace the SVG-designed effects from spec v2. Canvas
unlocks techniques that SVG cannot do efficiently.

### 5.1 Motion-blur clear (FREE)

Replace `ctx.clearRect()` with a semi-transparent fill:

```javascript
ctx.globalCompositeOperation = 'source-over';
ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```

Previous frame's particles fade to ~15% opacity instead of
vanishing. Creates natural motion trails without extra geometry.
Cost: zero (replaces an existing operation). Tunable: higher alpha
= shorter trails, lower = longer ghosting.

```javascript
MOTION_BLUR_ALPHA: 0.15,   // 0 = infinite trail, 1.0 = no trail (clearRect equivalent)
```

**Problem:** This technique requires the canvas to be opaque, but
ours overlays transparent SVG. **Solution:** Use a secondary
offscreen canvas for the motion-blur accumulation, then composite
onto the main transparent canvas each frame. The offscreen canvas
retains the trail; the main canvas gets `clearRect` + a copy from
the offscreen at reduced opacity.

Alternative: skip motion-blur clear entirely and use explicit
trail geometry (§5.4). Simpler, no offscreen canvas needed.
Decision at implementation time.

### 5.2 Per-particle radial gradients

```javascript
const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
grad.addColorStop(0, `rgba(${rgb}, 0.9)`);   // bright center
grad.addColorStop(1, `rgba(${rgb}, 0.0)`);    // soft edge
ctx.fillStyle = grad;
ctx.arc(x, y, r, 0, TAU);
ctx.fill();
```

Gas particles: soft edges (gradient fades to 0). They look like
luminous wisps, not flat discs. Physically correct — gas has no
sharp boundary.

Liquid particles: sharp edges (gradient stays opaque to 80% of
radius, then drops). Cohesive surface tension.

```javascript
GAS_GRADIENT_FALLOFF: 0.0,     // opacity at edge (0 = fully soft)
LIQ_GRADIENT_FALLOFF: 0.7,     // opacity at edge (high = sharp)
```

Cost: ~0.005ms per particle (vs 0.002ms for flat fill). At 1000
particles: +3ms. Affordable.

### 5.3 Additive blending for hot gas

```javascript
ctx.globalCompositeOperation = 'lighter';
// draw hot gas particles here
ctx.globalCompositeOperation = 'source-over';  // reset
```

Where particles overlap, brightness adds. Dense hot gas glows.
Sparse cold gas stays dim. Physically: thermal radiation is
additive. The player sees "this gas is hot and concentrated"
without any hue change (preserves color invariance rule).

Gate: only when `T > ADDITIVE_T_THRESHOLD` (e.g. 500K). Cool gas
uses normal compositing.

```javascript
ADDITIVE_T_THRESHOLD: 500,     // K — above this, use additive blend
```

### 5.4 Velocity streaks (trails)

```javascript
ctx.lineWidth = r * 2;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(x - dx, y - dy);  // tail
ctx.lineTo(x + dx, y + dy);  // head
ctx.stroke();
```

Trail vector `(dx, dy)` = path tangent × `speed × TRAIL_FACTOR`.
Fast flow = long streaks. Slow = dots (fall back to `arc`). Same
draw cost as circles. Direction encodes flow direction.

```javascript
TRAIL_FACTOR: 0.08,   TRAIL_MAX: 12,   TRAIL_MIN_SPEED: 20,
```

### 5.5 Liquid metaball

Draw liquid particles to offscreen canvas. Apply `ctx.filter =
'blur(Npx)'`. Composite back with threshold (draw at high opacity,
the blur merge + threshold creates blob boundaries).

```javascript
LIQUID_BLOB_BLUR: 2.5,
LIQUID_BLOB_OPACITY: 0.9,
LIQUID_BLOB_OVERDRAW: 1.3,    // radius multiplier to force overlap
```

### 5.6 Ambient glow on gas

```javascript
ctx.shadowBlur = GAS_GLOW_RADIUS;
ctx.shadowColor = `rgba(${rgb}, ${GAS_GLOW_OPACITY})`;
// draw gas particle
ctx.shadowBlur = 0;  // reset
```

Each gas particle gets a soft halo. Hot gas: larger halo. Cold gas:
smaller. Driven by T:

```javascript
GAS_GLOW_RADIUS_BASE: 2,          // px at T_REF
GAS_GLOW_RADIUS_T_SCALE: 0.5,     // exponent on T/T_REF
GAS_GLOW_OPACITY: 0.2,
```

Cost: ~0.003ms per particle. Affordable.

---

## 6. Unit depth (SVG)

### 6.1 Shadow plate

Dark rect behind each unit body, offset (3, 3)px. First child of
unit `<g>`. Matches body shape. One rect per unit.

### 6.2 Viewport inner glow

Radial gradient overlay on viewport panels:
```svg
<radialGradient id="vp-depth">
  <stop offset="0%" stop-color="#0f172a" stop-opacity="0"/>
  <stop offset="100%" stop-color="#000" stop-opacity="0.3"/>
</radialGradient>
```

---

## 7. Particle engine

### 7.1 Parameterized configs

Units supply config in `_PARTICLE_BEHAVIORS.units[defId]`. Generic
geometry + transform functions. No per-unit animation code.

### 7.2 Segments

| Segment | Geometry | Transform | Clipped to |
|---|---|---|---|
| `connection` | Bézier | None | Pipe window |
| `body-transit` | Linear / swirl | None / morph / split / absorb | Unit viewport |
| `body-source` | Emerge | Appear | Unit viewport |
| `body-sink` | Disperse | Disappear | Unit viewport |
| `body-store` | Scatter | Inventory | Unit viewport |

### 7.3 Geometry functions

`linear` `swirl` `converge` `disperse` `scatter`

### 7.4 Transform functions

- `none` — species color unchanged. Most units.
- `morph` — gradual color blend across reactor body. Each particle
  is assigned a destination species at spawn (weighted random from
  outlet composition). As it traverses the morph zone, its color
  interpolates: `rgb = lerp(inletRGB, destRGB, morphProgress)`.
  The player sees a continuous color gradient — reactants on one
  side, products on the other. Stoichiometrically defensible:
  conversion increases along reactor length (plug flow).
- `split` — phase-based routing. Gas species → vapor exit (up),
  liquid species → liquid exit (down). Flash drum, distillation.
- `absorb` — named species fade to invisible. CO₂ scrubber.
- `emerge` — particles spawn with outlet composition. Sources.
- `converge-to-exit` — scattered field → exit port. Air intake.

---

## 8. Data sources

All from solver Block 1 (NNG-11).

| Context | Source | Fields |
|---|---|---|
| Connection | `connStream` | `._anim`, `.T`, `.P`, `.phase` |
| Body ports | `ud.ports[portId]` | Same |
| Inventory | `u.last.n`, `u.last.T_K` | Mol fracs, temp |
| Vent | `u.last.vented_n` | mol/s per species |
| Fried | `_FRIED_SMOKE_CFG` | Constant |

---

## 9. Physics-to-visual mapping

| Visual | Driver | Mapping | Reads |
|---|---|---|---|
| Species color | composition | `_SPECIES_COLOR[sp]` fixed | "What?" |
| Spawn weight | mole frac | Weighted random | "How much?" |
| Shape | phase | Gas: soft gradient ellipse. Liquid: sharp circle | "Gas/liquid?" |
| Cohesion | phase | Liquid: metaball. Gas: individual | "Sticks/floats" |
| Size | P (gas) | `r × (P_ref/P)^0.2` | "Compressed" |
| Gap | ρ | Log: dense=tight, light=wide | "Heavy/light" |
| Speed | vDot | Linear, capped | "Fast/slow" |
| Trail | speed | `min(12, speed×0.08)` | "Moving" |
| Jitter | T×flow | `BASE×√(T/300)×(1+1.5×(vDot/ref)^0.3)` | "Hot/calm" |
| Glow halo | T | `shadowBlur ∝ √(T/300)` | "Hot gas" |
| Additive | T > 500K | `lighter` composite mode | "Hot & dense" |
| Spawn flash | nDot | Brightness at birth | "Energy here" |
| Phase flash | L→V | Spike at split zone | "Evaporation" |
| Opacity | phase | Gas: 0.55. Liquid: 0.9 | "Substance" |

Fourteen properties. Eight drivers. All monotonic.

---

## 10. Tuning parameters

All in `_PARTICLE_BEHAVIORS`. Edit, reload, see.

```javascript
const _PARTICLE_BEHAVIORS = {
  // Density
  DENSITY_SPACING: 12,  MAX_PER_SEGMENT: 20,
  DENSITY_SPACING_MIN: 8,  DENSITY_SPACING_MAX: 24,
  DENSITY_TARGET_MS: 12,  DENSITY_ADAPT_RATE: 0.5,

  // Speed / gap
  VDOT_REF: 0.025,  BASE_SPEED: 60,  MAX_SPEED: 200,
  GAP_MIN: 6,  GAP_MAX: 28,

  // Phase appearance
  GAS_OPACITY: 0.55,  LIQ_OPACITY: 0.9,
  GAS_ASPECT_MIN: 0.5,  GAS_ASPECT_MAX: 0.8,  GAS_ROTATION_DRIFT: 2,
  GAS_GRADIENT_FALLOFF: 0.0,  LIQ_GRADIENT_FALLOFF: 0.7,

  // Liquid metaball
  LIQUID_BLOB_BLUR: 2.5,  LIQUID_BLOB_OVERDRAW: 1.3,
  LIQUID_BLOB_OPACITY: 0.9,

  // Pressure sizing (gas)
  PRESSURE_SIZE_EXP: 0.2,  PRESSURE_SIZE_REF: 101325,
  PRESSURE_SIZE_MIN: 0.5,  PRESSURE_SIZE_MAX: 2.0,

  // Trails
  TRAIL_FACTOR: 0.08,  TRAIL_MAX: 12,  TRAIL_MIN_SPEED: 20,

  // Jitter: T × flow
  JITTER_BASE_GAS: 3,  JITTER_BASE_LIQ: 0.8,
  JITTER_T_REF: 300,  JITTER_T_EXP: 0.5,
  JITTER_FLOW_BOOST: 1.5,  JITTER_FLOW_EXP: 0.3,
  JITTER_CLAMP: 8,  BROWNIAN_SPRING: 0.95,

  // Glow
  GAS_GLOW_RADIUS_BASE: 2,  GAS_GLOW_RADIUS_T_SCALE: 0.5,
  GAS_GLOW_OPACITY: 0.2,
  ADDITIVE_T_THRESHOLD: 500,

  // Spawn flash
  GLOW_DURATION: 0.12,  GLOW_INTENSITY: 0.3,  GLOW_SIZE: 1.4,
  GLOW_NDOT_SCALE: true,  GLOW_NDOT_REF: 1.0,

  // Phase flash
  FLASH_PEAK: 0.5,  FLASH_DURATION: 0.15,  FLASH_SIZE_BOOST: 0.5,

  // Dispersal
  DISPERSE_RISE_PX: 35,  DISPERSE_FALL_PX: 20,
  DISPERSE_MAX_PARTICLES: 15,  DISPERSE_LATERAL_SPREAD: 4,

  // Convergence
  CONVERGE_RADIUS: 40,  CONVERGE_PARTICLES: 12,
  CONVERGE_SPEED_FACTOR: 0.8,

  // Body transit
  TRANSIT_DWELL_DEFAULT: 1.2,
  MORPH_ZONE_START: 0.3,  MORPH_ZONE_END: 0.7,

  // Per-unit configs (only overrides)
  units: {
    // Transit
    valve:          { type:'transit', path:'linear', transform:'none', dwellFactor:0.8, viewport:null },
    restriction:    { type:'transit', path:'linear', transform:'none', dwellFactor:0.6, viewport:null },
    pump:           { type:'transit', path:'swirl', transform:'none', dwellFactor:1.3, swirlTurns:0.75 },
    fan:            { type:'transit', path:'swirl', transform:'none', dwellFactor:1.0, swirlTurns:0.5 },
    compressor:     { type:'transit', path:'linear', transform:'none', dwellFactor:1.5 },
    compressor_diaphragm: { type:'transit', path:'linear', transform:'none', dwellFactor:1.5 },
    electric_heater:{ type:'transit', path:'linear', transform:'none', dwellFactor:1.0 },
    air_cooler:     { type:'transit', path:'linear', transform:'none', dwellFactor:1.0 },
    gas_turbine:    { type:'transit', path:'linear', transform:'none', dwellFactor:0.8 },

    // HEX: dual
    hex: { type:'dual-transit', dwellFactor:1.5,
           paths:{ hot:{entry:'hot_in',exit:'hot_out'}, cold:{entry:'cold_in',exit:'cold_out'} }},

    // Reactors: morph
    reactor_adiabatic:       { type:'transit', path:'linear', transform:'morph', dwellFactor:2.0, morphZone:[0.2,0.8] },
    reactor_jacketed:        { type:'transit', path:'linear', transform:'morph', dwellFactor:2.0, morphZone:[0.2,0.8] },
    reactor_cooled:          { type:'transit', path:'linear', transform:'morph', dwellFactor:2.0, morphZone:[0.2,0.8] },
    reactor_electrochemical: { type:'transit', path:'linear', transform:'morph', dwellFactor:2.5, morphZone:[0.3,0.7] },
    fuel_cell:               { type:'transit', path:'linear', transform:'morph', dwellFactor:2.5, morphZone:[0.3,0.7] },

    // Separation
    flash_drum:         { type:'split', entry:'mat_in',
                          exits:{ vap_out:'up', liq_out:'down' }, splitZone:[0.3,0.5], dwellFactor:2.0 },
    distillation_column:{ type:'split', entry:'mat_in',
                          exits:{ dist_out:'up', bot_out:'down' }, splitZone:[0.3,0.6], dwellFactor:3.0 },
    membrane_separator: { type:'split', entry:'mat_in',
                          exits:{ perm_out:'through', ret_out:'along' }, splitZone:[0.4,0.6], dwellFactor:2.0 },
    co2_scrubber:       { type:'transit', path:'linear', transform:'absorb', absorbSpecies:['CO2'], dwellFactor:2.5 },

    // Mixer / splitter
    mixer:    { type:'merge', entries:['mat_in_1','mat_in_2'], exit:'mat_out', mergeZone:0.5, dwellFactor:1.5 },
    splitter: { type:'fork', entry:'mat_in', exits:['mat_out_1','mat_out_2'], forkZone:0.5, dwellFactor:1.0, viewport:null },

    // Storage (deferred to Phase 5)
    tank:      { type:'store', maxPoolParticles:20, churnSpeed:0.3 },
    open_tank: { type:'store', maxPoolParticles:15, churnSpeed:0.3, ventMode:'disperse-gas' },

    // Sources
    source:    { type:'source', path:'emerge' },
    source_atm:{ type:'source', path:'converge', convergeRadius:40, convergeParticles:12 },
    closed_loop_source: { type:'source', path:'emerge' },
    reservoir: { type:'source', path:'emerge' },

    // Sinks
    sink: { type:'sink', disperseGas:'rise', disperseLiq:'fall' },

    // Electrical (no material particles)
    grid_supply:null, solar_panel:null, wind_turbine:null,
    battery:null, power_hub:null, power_dispatcher_5:null, sink_electrical:null,
  }
};
```

Viewport bounds read at runtime from icon geometry via
`_getUnitViewport(unitId)`. Not duplicated in config.

---

## 11. Performance

Canvas budget: 2000 particles in ~13ms (draw + advance).
Frame budget: 16ms. Count model: `segment_length / DENSITY_SPACING`.
Viewport culling: skip off-screen. Adaptive: auto-adjust spacing.

30-unit scene at DENSITY_SPACING=12: ~450 particles.
With depth layers: ~1050. Both within budget.

---

## 12. Implementation plan

### Phase 0: Foundation (3 sessions)

**0A: Canvas overlay** (1 session)
- Create `<canvas>` in flowsheet container
- `_syncCanvasTransform()` from SVG viewBox
- HiDPI resize handler
- Port `_flowState` draw from SVG to canvas (`ctx.arc`/`lineTo`)
- Port `_smokeState` draw to canvas
- Port `_ventState` draw to canvas
- Verify visually identical output
- Remove SVG particle groups, rebuild functions, filters, CSS

**0B: Pipe windows** (1 session)
- Implement `_bzSplit(bezier, t0, t1)` via de Casteljau
- 3-stroke connection rendering (outer wall, bore, window)
- Canvas clip paths from window Bézier + stroke width
- Connection particles clipped to windows
- Tune wall/bore/window colors and widths

**0C: Unit depth + viewport infrastructure** (1 session)
- Shadow plate helper: auto-generates shadow rect from body bbox
- Add shadow plates to all ragtag symbols (procedural, 1 helper call)
- Viewport inner glow gradient definition
- Add glow overlay to all viewport-bearing units
- `_getUnitViewport(unitId)` helper: returns world-coord rect/circle
  from icon geometry, or null for opaque units
- Canvas viewport clipping infrastructure

### Phase 1: Viewports + engine core (3 sessions)

**1A: Reactor viewport enlargement** (1 session)
- `_rtReactorVessel`: change `_rtVp` from r=16 to r=26
- Move bolts outward to new frame corners
- Retire 6 hardcoded SVG bubble elements
- Adjust chip/gauge/LED positions for larger window
- Verify all 3 reactor types + electrochemical + fuel_cell

**1B: Flash drum + HEX + air_cooler viewports** (1 session)
- Flash drum: replace 12px sight strip with 32×60 rect viewport
  - Move tick marks inside viewport right edge
  - Liquid level becomes density boundary (canvas particles, not SVG rect)
  - Retire SVG vapor bubble hints
- HEX: replace circle r=18 with rect 52×50, horizontal divider
- Air cooler: enlarge circle r=12 → r=20

**1C: Unified particle engine** (1 session)
- Single `_particleState` Map replacing three old maps
- `_PARTICLE_BEHAVIORS` registry with global constants
- `DENSITY_SPACING` count model
- Viewport culling (bbox intersection test)
- Connection particles: position via `_bzPt`, clip to window
- Basic draw: flat colored circles (effects come later)

### Phase 2: Body transit (2 sessions)

**2A: Linear transit** (1 session)
- Generic `_bodyTransitPath(unitId, config)`: returns entry/exit
  points in world coords from viewport bounds + port positions
- `linear` geometry: lerp between entry/exit
- Viewport-clipped canvas drawing
- Apply to: valve (null viewport = skip), compressor, heater,
  cooler, gas turbine, restriction
- Species pass-through (`transform: 'none'`)

**2B: Swirl + dual-transit** (1 session)
- `swirl` geometry for pump/fan: parametric helix between
  entry/exit, `swirlTurns` controls rotations
- `dual-transit` for HEX: two independent linear paths through
  top/bottom halves of viewport
- Verify pump impeller SVG animation + canvas particles coexist

### Phase 3: Transforms (3 sessions)

**3A: Morph (reactors)** (1 session)
- `morph` transform: gradual RGB color blend across reactor body
- Each particle assigned destination species at spawn (weighted
  random from outlet `speciesFracs`)
- Color: `lerp(inletSpeciesRGB, destSpeciesRGB, morphProgress)`
  where morphProgress = 0→1 across morphZone
- Apply to all 5 reactor types
- Visual: CO₂ red + H₂ cyan gradually becomes CH₄ green + H₂O blue

**3B: Split (separation)** (1 session)
- `split` transform: phase-based routing
- Read solver `nV`/`nL` to assign each particle to vapor/liquid exit
- Gas species drift upward, liquid species drift downward
- Split zone: particles change direction at the boundary
- Apply to flash drum, distillation column, membrane separator
- Flash drum: the star visual — gas bubbles rising, liquid sinking

**3C: Absorb + merge + fork** (1 session)
- `absorb` for CO₂ scrubber: CO₂ particles fade over body length
- `merge` for mixer: two inlet streams converge at mergeZone
- `fork` for splitter: stream bifurcates (splitter has null
  viewport — fork only shows in pipe windows before/after)

### Phase 4: Boundaries (2 sessions)

**4A: Sources + convergence** (1 session)
- `emerge`: particles spawn at body center with outlet composition
- `converge`: scattered field → funnel for source_atm/atmosphere
- Apply to all source variants, closed_loop_source, reservoir

**4B: Sinks + dispersal** (1 session)
- `disperse-gas`: particles rise from viewport top, brownian drift
- `disperse-liq`: particles fall from viewport bottom
- Phase-based routing (VL streams: both directions)
- Replace sink smoke with species-accurate dispersal
- Open tank vent: absorb current `_ventState` into dispersal
- `_smokeState` becomes fried-only

### Phase 5: Storage (2 sessions)

**5A: Tank viewports** (1 session)
- Design tank viewport (sight glass → larger window in body)
- Design open_tank viewport
- SVG icon changes + `_getUnitViewport` support
- Decide: gas headspace visible? Liquid pool? Both?

**5B: Inventory pool particles** (1 session)
- `scatter` geometry: persistent particles inside viewport
- Composition from `u.last.n` (inventory mole fractions)
- Churning drift within bounds
- Gas headspace: sparse, high jitter particles at top
- Liquid pool: dense, blobby particles at bottom
- Level boundary: visual density change at fill level

### Phase 6: Visual physics (3 sessions)

**6A: Phase rendering** (1 session)
- Gas: per-particle radial gradient (soft edges), ellipse rotation
- Liquid: sharp gradient + highlight dot, metaball filter
- Two canvas draw passes: liquid (with blur composite) then gas
- VL streams: particles assigned to correct pass

**6B: Physics-driven modulation** (1 session)
- Pressure sizing: `r × (P_ref/P)^0.2` for gas
- Temperature jitter: `BASE × √(T/300) × (1 + boost×flow)`
- Ambient glow: `ctx.shadowBlur ∝ √(T/300)`
- Additive blending above 500K threshold
- Velocity trails: `lineTo` with tangent direction

**6C: Event effects + tuning** (1 session)
- Spawn flash at sources/reactor outlets
- Phase transition flash at split zones
- Adaptive density throttle
- Full tuning pass with demo scene
- Performance profiling

### Phase 7: Polish (2 sessions)

**7A: Fried smoke + retire legacy** (1 session)
- Port fried smoke to canvas (only remaining `_smokeState` use)
- Retire `_computeSmokeConfig` sink path
- Retire all old SVG particle infrastructure
- Clean up dead code

**7B: Advanced geometry + depth** (1 session)
- Depth layering: 3 z-layers on connections (back/mid/front)
  with parallax size/opacity
- Splitter/mixer S-curve stub particles (Bézier path following)
- Final performance audit

---

## 13. Session count summary

| Phase | Sessions | Cumulative |
|---|---|---|
| 0: Foundation | 3 | 3 |
| 1: Viewports + engine | 3 | 6 |
| 2: Body transit | 2 | 8 |
| 3: Transforms | 3 | 11 |
| 4: Boundaries | 2 | 13 |
| 5: Storage | 2 | 15 |
| 6: Visual physics | 3 | 18 |
| 7: Polish | 2 | 20 |

**20 sessions total.** First playable result at session 6 (Phase 1
complete: pipe windows + enlarged viewports + connection particles).
Visually impressive at session 11 (Phase 3: reactor morph + flash
drum split). Beautiful at session 18 (Phase 6: all effects).

---

## 14. Rules

1. **Monotonic.** More physical → more visual. Never inverts.
2. **Zero = zero.** No flow → no particles.
3. **Phase = shape.** Gas: soft gradient ellipse. Liquid: sharp blob.
4. **Color invariant.** Species hue never changes with T, P, phase.
5. **No data, no visual.** Unresolved ports show nothing.
6. **Exaggeration, not fabrication.** Dampened is OK. Inverted is not.

---

## 15. NNG compliance

| NNG | How |
|---|---|
| NNG-3 | Colors = species. Density = flow. Phase = shape. |
| NNG-9 | Particles never affect solver state. |
| NNG-11 | Renderer reads `_anim` + stream fields. No thermo. |
| NNG-14 | Changelog per phase. |
| NNG-16 | Canvas overlay. Sight glass clipping. Monotonic physics mapping. Parameterized configs. |

---

## 16. Open questions

1. **Tank viewport design.** How much of the capsule body becomes
   window? Phase 5 decision.
2. **Electrical particles.** Amber dots on power lines? Deferred.
3. **Motion-blur clear vs explicit trails.** Two approaches to
   motion feel. Try both, pick better. Phase 6 decision.
4. **Depth layers.** 3 z-layers for volume. Phase 7 candidate.
