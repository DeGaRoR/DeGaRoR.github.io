# THE WATER SHADER — as built (H6, G460 … G460.5), and how it grows

The design's H6 (`WATER-2026-09-13.md` §3), built 2026-09-21 after the r186 migration. This
is the as-built record and the evolution map; the G entries in HANDOVER carry the day's
findings, `src/viewer/water.js`'s header carries the mechanism.

## 0. The rulings the build stands on (the user, 2026-09-21)

- **Ruling (aq) Gerstner-not-FFT stands**: the sea is a sum of trains in world data
  (`SEA.W`), the floats feel what the shader draws. The user first froze the two-train
  model pending the physics report; the report came the same day (waterH 0.9 → 4.1 µs a
  call at 32 trains, ~130 calls a frame — half a millisecond) and the sea became 32
  trains drawn from the spectrum (G460.3): two cosines are periodic by construction.
- **Interaction is a sampler input**: `WATER.setInteraction(tex, x0, z0, size)`. The field
  that writes it (a wake, a splash, a ripple) is H7.
- **Depth is analytic** off the coast and lake fields the ground carries; no depth buffer.
- The geometry is not distorted beyond what existed: the 360 m near patch was CPU-displaced
  already and is GPU-displaced now; the 400 km plane never moves; the `simple` tier lifts
  nothing.

## 1. What the research settled

Every credible system (Sea of Thieves, MSFS, Crest / UE Water, Triton, Proland, the 2026
three.js kits — Tidewater, clean-room-fft-ocean, Water Free) is one architecture: a wave
FIELD (GPU displacement + normal + foam from a JONSWAP spectrum through 2–4 FFT cascades)
and a surface SHADER (Fresnel, sky reflection, depth absorption, Jacobian crest foam, shore
foam). A lake, a river, a pool are the same shader retuned. The technique that matters for a
FLIGHT game is Bruneton 2010 / Proland: water is seen from 1 m to the horizon, and a wave
must be geometry at 1 m, a normal at 200 m and roughness at 2 km or it shimmers; the waves
finer than the pixel fold into a slope variance read off the screen-space footprint. That
is the spine of `water.js`, mapped onto three's own GGX + PMREM as a per-pixel roughness.
Sources: the plan of 2026-09-21 (`~/.claude/plans/…merry-deer.md`) lists them.

## 2. As built — three bands, one normal, one material, four bodies

`MeshPhysicalMaterial` (ior 1.333 = F0 0.02) + ONE module-level hook through ATMO's
accessor: probe, aerial perspective, mist, cloud shadow, near shadow, log depth all through
three's chunks.

| band | source | reaches | the physics feels it |
|---|---|---|---|
| 1 felt | `SEA.W` in GLSL (`uWTrA[32]`, `uWTrD[32]`, phases reduced mod 2π on the CPU): a swell band of 8 (0.78–1.28 L, ±18°, JONSWAP-shaped) + a wind sea of 24 (L/1.4–L/7, Hasselmann spread ±12°→±55°, equilibrium amplitudes), each band normalised to the old pair's variance; each train's slope fades where its own wavelength is under ~6 px | height (near patch), slope, fold (whitecaps) | yes — `waterH(x,z,t)`, parity held by GATE WATER |
| 2 detail | one baked tile (96 integer-wavenumber cosines, peaked k⁻³, ±75° spread) read at 3.2 m and 0.75 m, scrolled at each length's phase speed, strength the wind's | slope, crest mask | no |
| 3 sub-pixel | `wSigma2(footprint)`: Cox-Munk 0.003 + 0.00512 U10 × the unresolved fraction of the equilibrium tail | roughness = (2σ²)^¼ | no |

Colour: the column off the fields (sea: a 1:12 beach off the line capped by the island's
shelf, so the sand shows through a 40–60 m turquoise fringe; lake: 1.2 × its field to 8 m)
→ `sct (1 − e^(−2 abs d)) (1 − F)`; alpha = the shore's fade × the column's opacity.
**The body colour is not a Lambert surface** (G460.5): three would light it by dot(N, L)
on the wave normal — a painted relief; the material's diffuse is zeroed and the column
colour is added lit by the UP normal (each light's colour × saturate(up·L), the sky's
irradiance after the loop), so the waves live only in the reflection and the glitter.
The IBL normal is bent so the reflection never looks under the horizon. Foam: whitecaps
where the fold (in units of its RMS) exceeds the Gaussian quantile of Monahan's cover
(3.84e-6 U10^3.41 — 3 % at 7 m/s, 10 % at 10), a faint noisy wash over the last 14 m of the
shore, both on the water only. The ground keeps the beach's texture 60 m under the water
and paints the lake bed dark peat. Bodies by a vertex attribute
`aWater = (body, wavy)`: sea 0 / lake 1 / river 2 / premises 3, each a preset row in
uniforms — nothing per body in the GLSL, one program. Tiers `simple` / `full`; `?water=0`
the stock material; debug views 1–9.

Cost (tools/water_shot.js --perf / --ab, the queries round the water's own draws, 1080p,
the full tier): 0.3–0.4 ms at 12 m and over the coast; 1.2–2.0 ms at 300 m straight down
over open sea, where every pixel runs 32 trains (the rig's number there is noisy). The
lever if 1.0 ms must hold at that eye: the fragment normal from the 16 longest trains, the
detail tile + σ² carrying the 16 shortest (1–2 cm; the physics keeps all 32) — or the FFT
slot. Samplers: 8 of 16 (uWSdf, uWDetail, uWInter, envMap, uApAtlas, dfgLUT, two shadow
maps).

The clock: the solver publishes `sim.t` (it never had), app.js hands it to `WATER.setTime`
every step, the buoys and the patch read `WATER.time()` — ruling (ap) honoured for the
first time (render_world's own 1/60 accumulator drew the hull a frame away from the wave
that pushed it, pause or not).

## 3. What the pictures say (screenshots/water-g440/, by round)

- g9/g10/g11 (the last round): 7 m/s at 300 m — dark blue, wave groups, the sun's glitter,
  no relief; 4 m — the swell has volume through the reflection; the coast from 300 m —
  the beach under the water, a turquoise fringe, the deep is deep; 10 m/s — scattered
  whitecaps at every height; calm — glassy with the clouds' shadows; the lake dark and
  opaque with a peat rim.
- The seam across the sea at 1000 m (g5) was the cloud shadow tile's wrap line, not the
  water's (G460.4). The cyan cliffs on the far coast were the ground's seabed paint above
  the water (G460.2). The lattice in the ripples was the tile repeating (G460.2, hex
  stochastic tiling); the checkerboard / weave was the two-train model (G460.3).

## 4. How it grows (designed in, not built)

1. **The spectrum** — DONE as G460.3 (32 trains). What remains of it: fetch and depth
   (a lake's own short chop from its size; the wind sea limited by the water's depth),
   which `seaFrom` does not know yet — lakes stay glassy by their preset row.
2. **A live FFT for the detail band** (only if the open sea becomes the subject):
   1–2 cascades at 128²/256², ping-pong `WebGLRenderTarget`s (spectrum once, `h(k,t)` per
   frame, row/column butterflies, a normal pass; ≈ 0.1–0.4 ms) writing `uWDetail` and
   `uWDetailK.x`. `detailNormal(xz)` reads it unchanged. The physics does not feel it.
3. **H7 — the interaction field**: a world-locked ping-pong heightfield (256², ~160 m)
   following the aeroplane, the wave equation with damping, `WATER.stamp(x, z, r, amp)`
   driven by the hydro panels (vertical motion → a ring, horizontal → a wake; the energy
   the displaced volume), copied with an offset when its box moves; an analytic Kelvin V
   (19.47°) for the far trail. It writes the slot this chantier proved with the painted V
   (`WATER.paintTestV`). Spray and the rooster tail stay particles (app.js's), reading
   the same surface.
4. **A near-ring clipmap** with displacement, if the dock and float views ask for more
   than the 360 m patch; the shader is displacement-ready (band 1 in the vertex path).
5. **The depth buffer** as a refinement for hulls and docks (a waterline fade; a frame
   stale, as the clouds read it) — the fields stay the terrain's answer.
6. **Underwater** (§3.5 of the design): a tint and a fog when the eye goes under; the
   material is DoubleSide already.
7. **The sea floor as a beach**: the physics' shelf is −5 m at the line (28_island.js),
   so what shows through the shallows is a cliff's mesh with sand painted on it; a real
   beach profile in the terrain (and the hydro's depth) would let the shallows read from
   a low eye as they do from 300 m.
8. **The horizon at a low eye**: the sub-pixel roughness turns the far sea into a flat
   grey-white sheet under the mist; a horizon-band treatment (the sky's own colour at
   grazing, the mist's density over water) is owed to the sky chantier.
