# S-FLOW: Particle Flow Animation

### processThis v16.9.x

**Status:** DESIGN  
**Depends on:** S-ALIVE design session (Slice 2b in playtest plan)  
**Priority:** HIGH — most requested visual feedback from playtest #001

---

## Principle

Every stream is rendered as a flow of discrete particles moving through
the connection path.  The particles encode five physical quantities in
five independent visual channels — no numbers needed.  The physics is
computed by `ThermoAdapter.streamVisuals(stream)`, not by the renderer.

---

## What the solver already provides (per resolved stream)

```
stream.T              K              temperature
stream.P              Pa             pressure
stream.n              {sp: mol/s}    molar flow per species
stream.phase          'V'|'L'|'VL'  phase after flash
stream.vaporFraction  0–1           vapor fraction (β)
stream.nV             {sp: mol/s}    vapor-phase molar flows
stream.nL             {sp: mol/s}    liquid-phase molar flows
```

After this spec, the solver also writes:

```
stream._anim.nDot          mol/s       total molar flow
stream._anim.vDot          m³/s        total volumetric flow
stream._anim.rho           kg/m³       mixture density
stream._anim.speciesFracs  {sp: frac}  mole fractions
```

The renderer reads ALL of these as pure data.  No thermo calls from
Block 2.

---

## Physics layer: solver-side stream enrichment

**NNG-11 compliance:** The renderer (Block 2) never calls `thermo`
directly.  Instead, the solver's post-flash step (Block 1) enriches
each resolved material stream with animation-ready fields.  The
renderer reads these like any other stream property.

### New fields on resolved streams (written by solver)

```javascript
stream._anim = {
  nDot:          1.0,      // mol/s  — total molar flow
  vDot:          0.0246,   // m³/s   — total volumetric flow
  rho:           1.18,     // kg/m³  — mixture density
  speciesFracs:  { N2: 0.78, O2: 0.21, Ar: 0.01 },  // mole fractions
};
// stream.phase and stream.vaporFraction already exist
```

### Computation site

Inside `solveScene()`, after the PH-flash writes `T`, `P`, `n`,
`phase`, `nV`, `nL` onto each stream — append the `_anim` block.
This is the same location where `Hdot_J_s` is already computed.

```javascript
// Post-flash enrichment for animation (NNG-11: thermo access in Block 1 only)
if (stream.type === StreamType.MATERIAL) {
  const entries = Object.entries(stream.n || {});
  const nDot = entries.reduce((s, [, v]) => s + v, 0);
  if (nDot > 1e-15) {
    const speciesFracs = {};
    for (const [sp, ni] of entries) speciesFracs[sp] = ni / nDot;

    let vDot = 0, totalMass = 0;

    // Gas phase volume
    const nV = stream.nV || (stream.phase === 'V' ? stream.n : {});
    const nV_total = Object.values(nV).reduce((a, b) => a + b, 0);
    if (nV_total > 1e-15) {
      const dominant = Object.keys(nV).reduce((best, sp) =>
        nV[sp] > nV[best || sp] ? sp : best, null);
      const MW_V = Object.entries(nV).reduce((s, [sp, ni]) =>
        s + ni * (ComponentRegistry.get(sp)?.MW || 28), 0) / nV_total;
      const rho_V = thermo.density(dominant, stream.T, stream.P, 'V')
        || (stream.P * MW_V / 1000) / (8.314 * stream.T);
      const mass_V = nV_total * MW_V / 1000;
      vDot += mass_V / rho_V;
      totalMass += mass_V;
    }

    // Liquid phase volume
    const nL = stream.nL || (stream.phase === 'L' ? stream.n : {});
    const nL_total = Object.values(nL).reduce((a, b) => a + b, 0);
    if (nL_total > 1e-15) {
      const dominant = Object.keys(nL).reduce((best, sp) =>
        nL[sp] > nL[best || sp] ? sp : best, null);
      const MW_L = Object.entries(nL).reduce((s, [sp, ni]) =>
        s + ni * (ComponentRegistry.get(sp)?.MW || 28), 0) / nL_total;
      const rho_L = thermo.density(dominant, stream.T, stream.P, 'L') || 1000;
      const mass_L = nL_total * MW_L / 1000;
      vDot += mass_L / rho_L;
      totalMass += mass_L;
    }

    stream._anim = {
      nDot, vDot,
      rho: vDot > 0 ? totalMass / vDot : 1,
      speciesFracs
    };
  }
}
```

### Why thermo.density and not raw RT/P

The active thermo package may be Peng-Robinson, which corrects gas
density via the compressibility factor Z.  At high pressures (tanks,
compressor outlets), ideal gas overpredicts volume by 10–30%.  By
routing through `thermo.density()` in the solver (Block 1, where
thermo access is legal), the animation automatically uses the same
physics as the solver.

---

## Visual mapping (renderer, Block 2)

The renderer reads `stream._anim` (written by solver) and `stream.phase`
/ `stream.vaporFraction` (written by flash).  No thermo calls.  Pure
data reading.

### Particle speed

```
speed_px_per_s ∝ _anim.vDot
```

Proportional to volumetric flow (from `stream._anim.vDot`).  This IS the bulk velocity (for
constant pipe cross-section).  After a valve: gas expands → vDot
rises → particles accelerate.  After a compressor: vDot drops →
particles slow.  Liquid streams are very slow (high density, small
volume per mole).

Normalization: map `_anim.vDot` range [0, vDot_ref] to [0, max_px_speed].
`vDot_ref` calibrated so a typical T1 gas stream at 1 mol/s / 1 atm
moves at a comfortable visual speed (~60 px/s).

### Particle spacing

```
gap_px ∝ 1 / _anim.rho
```

Inversely proportional to mixture density (from `stream._anim.rho`).  High pressure gas:
particles packed tight.  Low pressure gas: spread apart.  Liquid:
very tight (ρ ~1000 vs gas ρ ~1).

This means the inter-particle distance physically represents the
average distance between molecules.  After a compressor, particles
bunch up.  Through a valve, they spread apart.

Normalization: map `_anim.rho` range to gap range [min_gap, max_gap].
Gas at 1 atm ≈ 1.2 kg/m³ → large gap.  Liquid ≈ 1000 kg/m³ → min gap.

### Particle rate conservation

The product `speed × linear_density` must equal `_anim.nDot` at every
point.  This is automatically satisfied because:

```
speed ∝ vDot = nDot / C_molar
linear_density ∝ rho ∝ C_molar × MW
rate = speed × density ∝ (nDot / C_molar) × C_molar = nDot  ✓
```

At a splitter: `_anim.nDot` halves → half as many particles per second
in each branch.  At a mixer: particle rates add.  Mass conservation is
literally visible as particle count conservation.

### Particle color

Each particle represents one "packet" of a single species.  When
spawning a particle, sample from `speciesFracs`:

```javascript
function sampleSpecies(fracs) {
  const r = Math.random();
  let cumulative = 0;
  for (const [sp, f] of Object.entries(fracs)) {
    cumulative += f;
    if (r < cumulative) return sp;
  }
  return Object.keys(fracs).pop();
}
```

Species colors reuse the existing `_SPECIES_COLOR` palette (L25895),
already used by the composition `colorBy` mode.  The renderer converts
the RGB array to a CSS color string:

```javascript
// Existing palette (Block 2, L25895):
const _SPECIES_COLOR = {
  H2O: [59, 130, 246],   // blue — water
  CO2: [239, 68,  68],   // red — greenhouse
  CH4: [249, 115, 22],   // orange — fuel gas
  H2:  [132, 204, 22],   // lime — hydrogen
  N2:  [148, 163, 184],  // silver — inert
  O2:  [34, 211, 238],   // cyan — oxidiser
  NH3: [20, 184, 166],   // teal — ammonia
  Ar:  [139, 92, 246],   // violet — noble
  He:  [236, 72, 153],   // pink — noble
  CO:  [251, 191, 36],   // amber — syngas
};
// Default for unknown species: [148, 163, 184] (grey)
```

No new color definitions needed.  The same colors appear in
composition-mode pipe coloring, the species list in the inspector,
and now in individual particles — visual consistency across all three.

**Note:** These colors should also be visible in the species list
panel.  If they aren't currently shown as colored swatches next to
species names, that's a separate small fix — add a colored dot
next to each species entry in the inspector.

Multi-species streams show a visually mixed sequence: a 78% N₂ /
21% O₂ / 1% Ar stream produces ~4 silver particles per cyan, with
an occasional violet.  The player reads composition by glancing at
the color mix.

### Particle shape (phase)

| Phase | Shape | Description |
|-------|-------|-------------|
| Gas   | Translucent circle, soft edge | Vapor puff |
| Liquid | Opaque circle, hard edge | Droplet bead |

For two-phase streams (VL): each particle is independently assigned
gas or liquid shape based on `vaporFraction`.  β = 0.7 → 70% of
particles are translucent puffs, 30% are opaque droplets.

The flash drum money shot: mixed puffs+droplets enter.  Top outlet:
puffs only, fast, spread apart.  Bottom outlet: droplets only, slow,
packed tight.

### Particle size

Constant.  3–4 px diameter.  Size does not encode physics (pipe width
is already constant; particle size varying would be confusing).

---

## Full flow path topology

Each connection in the scene defines one complete particle path
assembled from three geometric segments:

```
 ┌─────────┐                                      ┌─────────┐
 │  Unit A  ├──stub──●  ───── connection ─────  ●──stub──┤  Unit B  │
 │  (body)  │  out   port                    port  in    │  (body)  │
 └─────────┘                                      └─────────┘
              ← body edge to port →          ← port to body edge →
```

- **Outlet stub:** Linear segment, body edge → port.  From `_rtNozzle`
  geometry of the source unit.  Stream data from `ud.ports[fromPortId]`.
- **Connection path:** SVG polyline/path between ports.  From
  `drawConnections()`.  Stream data from the upstream (source) port.
- **Inlet stub:** Linear segment, port → body edge.  From `_rtNozzle`
  geometry of the destination unit.  Stream data from
  `ud.ports[toPortId]` (same stream, downstream side of the connection).

The renderer treats these three segments as one continuous path for
particle spawning and recycling.  A particle born at the outlet body
edge travels through all three without discontinuity.

### Fan-out connections

When a port has `fanOut: true` (e.g. tank `gas_out` feeding multiple
sinks), each fan-out connection is a separate particle path with its
own `_getConnStream()` flow data.  The outlet stub is shared visually
but particles fork at the port endpoint into their respective
connection paths.

---

## Animation timing

### Sim-state sync (NNG candidate)

- **Playing:** Particles move.  Speed from `streamVisuals`.
- **Paused:** Particles frozen in place.  Visible but static.
  Player can see the density/color/phase pattern but nothing moves.
- **Step:** On step, advance particles by one frame worth of motion
  (dt-scaled), then freeze again.

This matches the principle: cosmetic ambient animation (planet sky)
runs always, but equipment/flow animation tracks sim state.

### Render budget

Particles are simple SVG circles (or tiny `<use>` refs) animated via
`requestAnimationFrame` position updates.  No CSS keyframes — position
must track sim time, not wall clock.

Budget: max ~200 particles visible on screen.  For a 10-connection
scene with 15 particles per connection = 150 particles.  Each is one
SVG circle with `cx` update per frame.

Particles recycle: when a particle exits the path end, it requeues
at the path start.  Pool size per connection = ceil(path_length /
gap_px).

---

## Stub particles (ragtag theme)

Ragtag stubs are short pipe segments from the unit body edge to the
port position.  They already carry per-port stream data for conditional
coloring (`_rtPortColors` reads `ud.ports[portId]`).  Particles use
the same data source.

### Stub as part of the flow path

A complete visual flow path is:

```
outlet stub → connection path → inlet stub
```

Particles are spawned at the outlet stub origin (body edge), travel
through the stub to the port endpoint, continue along the connection
SVG path, and enter the downstream unit's inlet stub from port
endpoint to body edge.

### Direction

- **Outlet stubs:** particles move FROM body edge TO port endpoint
  (out of the unit, toward the connection).
- **Inlet stubs:** particles move FROM port endpoint TO body edge
  (into the unit, away from the connection).

This is consistent with the physical flow direction.  The player sees
particles emerge from the unit, travel the pipe, and enter the next
unit.

### Unconnected stubs

Unconnected ports already show directional arrows (▶ for OUT, ◀ for
IN).  An unconnected port with resolved stream data (e.g. a sink's
inlet, a source's outlet) should show static particles — present but
frozen — to indicate "fluid is here but going nowhere."  An
unconnected port with no stream data shows no particles (empty pipe).

### Data source

Same as conditional coloring: `scene.runtime.unitData.get(unitId).ports[portId]`.  
Read `stream._anim` for speed, spacing, species fractions.  Read
`stream.phase` and `stream.vaporFraction` for particle shape.  The
stub particle properties (color, shape, spacing) match exactly what
the connected pipe shows — visual continuity across the stub-connection
boundary.

### Geometry

Stubs are straight lines (x1,y1 → x2,y2) computed by `_rtNozzle` from
body bbox and port position.  The particle path is trivially a linear
interpolation along this line.  No SVG path needed — just lerp between
endpoints.

### Consistency with conditional coloring

When `colorBy` mode is active (temperature, pressure, phase, etc.),
stub pipe color already reflects stream conditions.  Particles ride
on top of this colored stub.  The two systems are complementary:
stub color = broad condition overview, particles = detailed flow
behavior.  Both read the same `ud.ports[portId]` data.

---

## Electrical streams

Electrical connections use a different visual: small ⚡ symbols (or
yellow dots) moving along the path.  Speed proportional to `actual`
power.  Zero power = frozen.  This distinguishes power from material
at a glance.

---

## NNG impact

| NNG | Impact |
|-----|--------|
| NNG-1 | Particle rate conservation: speed × density = nDot at every junction. Visual mass balance. |
| NNG-3 | WYSIWYG: player sees flow magnitude, composition, phase, pressure without reading numbers. |
| NNG-9 | `_anim` computed in solver (Block 1) alongside existing stream enrichment. No tick mutation. |
| NNG-10 | Uses `thermo.density()` in solver post-flash. Respects active thermo package (ideal or PR). |
| NNG-11 | All thermo calls in Block 1 (solver). Renderer (Block 2) reads `stream._anim` as pure data. |

---

## Scope

- Solver post-flash: stream `_anim` enrichment (~30 lines in `solveScene`).
- Connection renderer: new particle system on SVG paths, ~150 lines.
- Stub renderer: particles on `_rtNozzle` stubs (outlet→port, port→inlet), ~60 lines.
- Animation loop: integrate with existing `requestAnimationFrame` + sim state, ~30 lines.
- CSS: minimal (particle base styles), ~10 lines.
- No new ComponentRegistry fields (reuses existing `_SPECIES_COLOR`).

---

## Conservation self-check

At every junction (splitter, mixer, unit boundary), the renderer can
verify from `stream._anim`:

```
Σ(nDot_in) ≈ Σ(nDot_out)    within tolerance
```

If violated, that's a visible NNG-1 bug: particles appearing or
disappearing at a junction.  The animation becomes an automatic
mass balance auditor.

---

## What this teaches without words

| Scenario | What player sees |
|----------|-----------------|
| Valve throttle | Particles accelerate, spread apart (gas expands) |
| Compressor | Particles slow down, pack tight (gas compressed) |
| Air cooler | Particles slow slightly; if condensing, puffs → droplets |
| Flash drum | Mixed puffs+drops in → puffs out top, drops out bottom |
| Splitter | Stream becomes less busy (fewer particles/s per branch) |
| Mixer | Two colored streams merge into mixed-color busier stream |
| Pump | Dense slow drops, barely change (liquid incompressible) |
| Oversized source → tiny cooler | Torrent of particles → same pipe, same equipment. Mismatch is visceral. |
| Unconnected outlet | Static particles sitting in stub — fluid present but going nowhere. |
| Stub → connection → stub | Seamless particle flow from unit body through pipe into next unit. No dead gaps. |
