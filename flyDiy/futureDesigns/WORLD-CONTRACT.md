# WORLD-CONTRACT — separating world data from rendering and physics

Status: **draft v0 for the world session**. Editable working document.
⚙ = tunable decision · ⏳ = consciously deferred · ⛙ = reconciliation note
for the desktop agent merging back to main.

## 0. Principle

The world is a **pure, deterministic, seed-driven data API**. Three consumers
— physics, renderer, gates — read it independently and never talk to each
other. No consumer redefines world data; the renderer may *resample* (LOD,
decimation) but the authoritative value at any (x, z) comes from one
implementation. No rendering types (THREE.*) anywhere in the contract:
plain numbers, arrays, records.

Consequence: the two open decisions (renderer tech, procedural vs. real data)
both become swappable implementations behind this contract. The contract is
the only thing that must be right early.

## 1. Current state (measured, not assumed)

`makeWorld()` lives in flight_core.js and returns:

| member | consumers |
|---|---|
| `terrainH(x,z)` | physics ground contact (2 sites), renderer terrain mesh, tests |
| `trees` `[{x,z,h,s}]` + `treesNear(x,z,out)` + `CELL` | physics tree collision, renderer instancing, tree gate |
| `meadows` `[{x,z,r,h}]` | terrain blending, renderer beacons, tests |

Implicit world data hiding elsewhere:
- runway location/heading: hardcoded carve terms inside `h0` (dxR/dzR) plus
  AP params (`xTurn`, `xAim`, `targetDir` along −x) — the runway *exists only
  as a flattening exception and autopilot constants*;
- corridor flattening (dxC/dzC), sea to +z, mountain belt to −z: baked into
  `h0` shape functions;
- surface type: nonexistent (physics uses one friction everywhere; the
  renderer color-bands by altitude only).

⛙ Main-branch reconciliation: extraction of `makeWorld` into its own
`world_core.js` (inlined by build.py like model_codec) touches flight_core.
The call sites listed above are the complete surface; nothing else in the
core reads world state.

## 2. The contract (v1)

```js
const W = makeWorld(seed);          // pure; same seed => identical world
W.v                                  // contract version (int)
W.seed
W.bounds                             // { x0, z0, x1, z1 }, sea level = 0

// --- continuous fields (analytic, O(1), no allocation, hot-path safe) ---
W.terrainH(x, z)                     // ground height; single source of truth
W.waterH(x, z)                       // water surface height or -Infinity
W.surface(x, z)                      // small int enum: GRASS ROCK SCREE
                                     //   FOREST_FLOOR WATER PAVED GRAVEL SAND

// --- discrete features, tiled ---
W.TILE                               // tile edge length (m)  ⚙ ~512
W.tile(ix, iz) -> {                  // deterministic per (seed, ix, iz);
  trees:   [{x, z, h, s, sp}],       //   lazily generated, cached; sp=species
  rivers:  [{pts:[[x,z]..], w, d}],  //   polyline reaches with width/depth
  roads:   [{pts, cls}],             //   cls: track|road|bridge
  buildings: [{x, z, w, l, hgt, rot, kind}],
}

// --- global registries (small, eager) ---
W.aerodromes                         // [{id, name, x, z, hdg, len, wid,
                                     //   surface, elev, kind: main|strip|
                                     //   meadow, tdz:[x,z]}]
W.settlements                        // [{x, z, r, pop, name}]

// --- physics accelerators (preserved from v0) ---
W.treesNear(x, z, out)               // spatial-hash query, allocation-free
```

### Contract rules

1. **Determinism**: every value is a pure function of (seed, coordinates).
   Tile generation order must not matter. Gates rely on this.
2. **Single implementation** of `terrainH`: physics, renderer and gates call
   the same function. The renderer never keeps a divergent copy — it samples.
3. **Continuity**: `terrainH` is C¹ almost everywhere (wheel contact and the
   flare are sensitive to slope discontinuities); feature flattening (runways,
   riverbeds) uses smoothstep SDF blends, exactly like today's meadow blend.
4. **Hot-path budget** ⚙: `terrainH` ≤ ~1 µs (called per wheel per substep
   plus per rendered vertex at load); `tile()` amortized ≤ 5 ms, cached;
   `treesNear` allocation-free as today.
5. **Back-compat**: v0 shim exports `{terrainH, trees, treesNear, meadows,
   CELL}` from the v1 object so every current consumer runs unmodified
   during migration. `meadows` ≡ aerodromes of kind `meadow`.
6. **AP integration** ⛙: runway constants in `def.params.ap` become lookups
   into `W.aerodromes` (circuit = takeoff aerodrome → target aerodrome).
   This is the one physics-side change beyond the extraction; it is what
   makes "lots of little airports" flyable rather than decorative.
7. **Surface → friction** ⏳: ground contact reads `W.surface` for per-type
   rolling/braking coefficients (paved vs grass vs gravel). Deferred until
   the world session; contract reserves the enum now.

## 3. Renderer position (informative, not binding)

The 2000-era look is a *consumer* problem, not a data problem: 45 m polygons,
altitude-only coloring, cone trees. The contract deliberately provides what a
modern terrain pass needs — `surface` classes for splatting, species for
varied instancing, river/road polylines for decals or geometry — without
prescribing the renderer. Three.js with chunked LOD + triplanar splat
materials is the default assumption; a renderer swap is a consumer rewrite
with zero contract change.

## 4. Gate strategy

World gates assert on **data, never pixels**:
- determinism: two `makeWorld(seed)` instances agree on sampled fields and
  tile contents; different seeds differ;
- hydrology invariants (see WORLD-GEN-PROC stage 1);
- every aerodrome: max slope along centerline < ⚙ threshold, tree-free
  within its box, `surface` consistent with its record;
- road graph connected; bridges exactly at river crossings;
- performance: N×10⁶ `terrainH` calls under budget;
- back-compat: v0 shim keeps M3/TREE gates green **unchanged** — the
  strongest migration safety net we have.

## 5. Migration order (for the world session)

1. Extract current world verbatim → `world_core.js` + v0 shim; battery green.
2. Introduce v1 surface alongside (terrainH unchanged); consumers migrate
   one by one; battery green at every step.
3. Only then start replacing the interior per WORLD-GEN-PROC.
