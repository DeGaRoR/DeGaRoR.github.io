# WORLD-CONTRACT — separating world data from rendering and physics

Status: **v1 implemented 2026-08-03** (pure restructuring session: contract +
v0 shim in `src/core/20_world.js`, world bit-identical, GATE WORLD added;
the interior is still the v0 world — WORLD-GEN-PROC stages fill it next).
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

`makeWorld()` lives in `src/core/20_world.js` (a build part concatenated into
tools/flight_core.js by **tools/build.js** — the earlier `build.py` reference
was wrong) and, pre-contract, returned:

| member | consumers |
|---|---|
| `terrainH(x,z)` | physics ground contact (2 sites), renderer terrain mesh, tests |
| `trees` `[{x,z,h,s}]` + `treesNear(x,z,out)` + `CELL` | physics tree collision, renderer instancing, tree gate |
| `meadows` `[{x,z,r,h}]` | terrain blending, renderer beacons, tests |
| `wind(x,y,z,t)` + `setWind(spec)` | solver strip/blob/prop flow (session 3); WIND gate — **missing from this doc's first draft**, now part of the contract surface |

Implicit world data hiding elsewhere:
- runway location/heading: hardcoded carve terms inside `h0` (dxR/dzR) plus
  AP params (`xTurn`, `xAim`, `targetDir` along −x) — the runway *exists only
  as a flattening exception and autopilot constants*;
- corridor flattening (dxC/dzC), sea to +z, mountain belt to −z: baked into
  `h0` shape functions;
- surface type: nonexistent (physics uses one friction everywhere; the
  renderer color-bands by altitude only).

⛙ Reconciled 2026-08-03: no extraction was needed — the 2026-08-02
restructure had already made the world its own MANIFEST.core part
(`20_world.js`); the contract was implemented by reshaping that file in
place. The call sites listed above are the complete surface; nothing else
in the core reads world state.

⛙ The runway was (and until stage 4 still is) encoded **four times,
independently**: the `h0` carve box x∈[−1180,130] |z|<90, the AP fiche
constants (xTurn/xAim/gs + heading hardcoded in 40_autopilot.js), the
renderer airfield decals (strip 1100 m centred x=−520, all literal numbers),
and the renderer field-patchwork mask. `W.aerodromes[0]` now records it as
data; single-sourcing the carve/decals lands with stage 4's parameterized
grading.

## 2. The contract (v1)

```js
const W = makeWorld(seed);          // pure; same seed => identical world
                                     // seed 0 / no arg = the VALIDATED world,
                                     // bit-identical to pre-contract makeWorld();
                                     // nonzero seeds: coherent but unvalidated
W.v                                  // contract version (int) — 1
W.seed
W.bounds                             // { x0, z0, x1, z1 }, sea level = 0
                                     //   implemented: ±4500 (⚙ 24 km later)

// --- continuous fields (analytic, O(1), no allocation, hot-path safe) ---
W.terrainH(x, z)                     // ground height; single source of truth
W.waterH(x, z)                       // water surface height or -Infinity
W.surface(x, z)                      // small int enum: GRASS ROCK SCREE
                                     //   FOREST_FLOOR WATER PAVED GRAVEL SAND
W.SURFACE                            // the enum table itself (name -> int)

// --- discrete features, tiled ---
W.TILE                               // tile edge length (m)  ⚙ decided: 512
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

// --- wind (session-3 plumbing; part of the contract, missed by draft v0) ---
W.wind(x, y, z, t)                   // returns a SHARED mutable [wx,wy,wz] —
                                     //   consume immediately, never store
W.setWind(spec)                      // { base:[x,y,z], gust:g } | null
```

Implemented v1 notes (2026-08-03): `hdg` is radians from +x toward +z (main
strip hdg = π, takeoff run along −x); main tdz = [−450, 0] (centre of the
gated M3 touchdown window); meadow records carry their blend radius `r`;
`waterH` serves stage-1 hydrology since 2026-08-03 (river reach surfaces,
lake spill heights, sea where the pre-carve base < 0) and `surface` is
the stage-2 biome classifier (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/GRASS)
plus stage-3 GRAVEL on road centrelines (PAVED still reserved for stage
4). Tree records carry `sp` (species 0-4). `W.settlements` and
`W.tile()` rivers/roads/buildings are live; `W.hydro` and `W.roadNet`
are informative non-contract blocks for gates/debug. Seed enters as
`SALT = imul(seed, 0x9E3779B9)` added into the noise hash and tree-LCG init;
stage 0 rework must preserve the seed-0 identity or consciously re-capture
the GATE WORLD goldens.

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
5. **Back-compat** — IMPLEMENTED: v0 shim exports `{terrainH, trees,
   treesNear, meadows, CELL, wind, setWind}` on the v1 object so every
   current consumer runs unmodified during migration. `meadows` is derived
   from aerodromes of kind `meadow` (same literals, same order — that
   derivation is what keeps the tree RNG and terrain blend bit-identical).
6. **AP integration** ⏳ deferred-next (user decision 2026-08-03): runway
   constants in `def.params.ap` become lookups into `W.aerodromes`
   (circuit = takeoff aerodrome → target aerodrome). This is the one
   physics-side change beyond the extraction; it is what makes "lots of
   little airports" flyable rather than decorative. Until then
   `W.aerodromes` is **descriptive, not authoritative** — the AP still
   flies its fiche constants and heading is still hardcoded in
   40_autopilot.js.
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

World gates assert on **data, never pixels**. GATE WORLD shipped 2026-08-03
(tools/test_world.js, appended to the battery, ~2 s) with:
- **golden freeze**: FNV-1a hashes of a 101² terrainH grid (±4500, step 90),
  all 2200 tree records, the meadow records, plus 4 exact anchor values —
  captured from the PRE-contract build, so seed 0 is pinned bit-identical.
  Any intentional terrain change must re-capture goldens in the same commit:
  ```
  node -e "const {makeWorld}=require('./tools/flight_core.js');const W=makeWorld();
  const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return(h>>>0).toString(16);};
  const g=[];for(let j=0;j<=100;j++)for(let i=0;i<=100;i++)g.push(W.terrainH(-4500+90*i,-4500+90*j));
  console.log('GRID',fnv(g.join(',')));
  console.log('TREES',fnv(W.trees.map(t=>t.x+','+t.z+','+t.h+','+t.s).join(';')),W.trees.length);
  console.log('MEADOWS',fnv(W.meadows.map(m=>m.x+','+m.z+','+m.r+','+m.h).join(';')));
  console.log(String(W.terrainH(-320,0)),String(W.terrainH(-2500,-500)),String(W.terrainH(1234.5,-987.25)),String(W.meadows[0].h));"
  ```
- determinism: two same-seed instances agree on sampled fields and tile
  contents; different seeds differ; `makeWorld()` ≡ `makeWorld(0)`;
- aerodromes: main centreline flat (<1e-9) + slope < 0.005, tree-free box
  +30 m margin, meadow elev === terrainH(centre), meadow boxes tree-free;
- tile contract: union of tiles === trees (object identity), per-tile
  bounds, cache identity;
- surface/waterH consistency (WATER ⇔ waterH > terrainH — written to
  survive the stage-1 replacement), treesNear index contract, wind
  shared-zero fast path;
- performance: 10⁶ `terrainH` calls < 2500 ms (measured ~0.3–0.6 µs/call);
- back-compat: the whole battery is byte-identical (timing aside) through
  the restructure — the strongest migration safety net we have.
Still future (stage-gated): hydrology invariants (WORLD-GEN-PROC stage 1);
road graph connected; bridges exactly at river crossings.

## 5. Migration order (for the world session)

1. ~~Extract current world verbatim + v0 shim; battery green.~~ DONE
   2026-08-03 (in-place reshape of `20_world.js`; no separate file needed).
2. ~~Introduce v1 surface alongside (terrainH unchanged).~~ DONE same
   session; consumers still read the shim — they migrate opportunistically.
3. Only then start replacing the interior per WORLD-GEN-PROC — **next
   session: stage 1 hydrology on the current terrain**.
