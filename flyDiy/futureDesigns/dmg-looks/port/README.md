# DMG-LOOKS port kit: drop-in pieces for the Deform session (26 Oct 2026)

This kit makes merging DMG-LOOKS fast. Everything here is pure (no THREE, no DOM): JS with its GLSL beside it, the same
recipe line for line. `check_port.js` holds the GLSL to the JS on a real WebGL2 (headless Chromium, SwiftShader). Copy
the modules into `src/viewer/` (or load them as they are) and wire them as below. Nothing here touches a file on
`claude/dmg-looks`.

**Rulings in force:**
- the user, 25 Oct: grey primer, P2 option B, no crazing on hard landings;
- the user, 26 Oct: **B3** for the rim overlay, **outer skin only**.

| File | What it is |
|---|---|
| `dmg_looks_noise.js` | the seeded noise (`h1 / v1 / fbm1 / h2 / v2 / fbm2`), JS and GLSL (`dlFbm1`, `dlV2`, `dlFbm2`...); integer hash, so JS and GLSL agree |
| `dmg_looks_alloy.js` | the alloy frame slot for the member pool: `canon()`, `slotState()`, `poseJS / fragJS`, and `GLSL` (`dlAlloyPose`, `dlAlloyFrag`) |
| `dmg_looks_rim.js` | the B3 rim: `isOuter()`, `RimState` (incremental per record, per event), `rimBandsJS`, and `GLSL` (`dlRimBands`) |
| `check_port.js` | the gate: `node futureDesigns/dmg-looks/port/check_port.js` gives `PORT CHECK: PASS`. Run it before and after pasting the GLSL. |
| `rim_events.js` | `RimState` on the real snapshot, ridden by skin_break through the standard crashes, timed per frame (`rim_events.txt`) |
| `render_port.js` | the ported alloy slot drawn (`port_alloy.png`): the port reads as the prototype |

## 1. The alloy slot in the member pool

**The canonical mesh.** `canon()` builds it once at roll-out:

- 252 vertices, **480 triangles** a slot, 21 rings (4 / 12 / 4, clustered round the slot's event).
- Per vertex, 6 floats: `k` (the ring's place, −1..1), `sx`, `sy` (the cage's metalAngle section: two prisms, w 30 mm,
  T 5 mm), `leg` (0 riveted, 1 outstanding), `d` (from the heel), `u` (developed: −d riveted, +d outstanding).
- A `Uint16` index.

**The slot state.** `slotState(o)` at the event returns a `Float32Array(16)`:

- `{ mode: 0, L0, kt1, seed }` for a crushed member;
- `{ mode: 1 | 2, L0, tb, seed }` for each piece of a torn one. A torn member takes two slots, one per piece.
- Upload it as 4 RGBA32F texels a slot, or as `uniform float[16]` in a per-slot draw.

**The vertex shader:**

```glsl
float xo;
vec3 p = dlAlloyPose(a, S, A, B, up, xo);   // A, B: the slot's two live nodes; up: the section's up
```

- `a` is the 6 attributes; `S` is the slot's 16 floats.
- A and B come from the node texture DMG-SKINGPU already uploads.
- Pass `xo`, `u` and a "wide face of the riveted leg" flag to the fragment shader.

**The fragment shader:**

```glsl
vec4 c = dlAlloyFrag(xo, u, flatR, gl_FrontFacing, S);
if (c.a < 0.5) discard;
```

- The pool's own program may discard; the aeroplane's one program may not.
- Use `c.rgb` as the albedo: grey primer, bare alloy at the crack, the fracture face on the inside.

**Physics dials** (`DEF`):

- `H_K` (1.0) and `EFF` (0.73): the fold half-length H = H_K (w²t)^(1/3), and the length a fold eats. Both are as
  recalled from Wierzbicki & Abramowicz 1983; the constants are not verified.
- `pitch` (22 mm), `rivetAt` (0.55 w).

**Gate.** `check_port.js` ALLOY:

- the GLSL pose against `poseJS` over 3,024 vertices and 12 slots (crushed 0-90 mm, torn A / B, random
  orientations): worst 0.001 mm;
- fragments: 7,200 / 7,200 the same.

## 2. The rim overlay, B3, outer skin only

**On the CPU** (in skin_break's event, per record):

```js
// at binding, per record R with its group g (brkCage knows g.sec, g.role, the layer per vertex, the class per vertex):
R.rim = new DMG_LOOKS_RIM.RimState(R, v => DMG_LOOKS_RIM.isOuter(g.sec, g.role, layerOf(v), clsOf(v)));
// after every SKIN_BREAK.event(R, ...):
const u = R.rim.update();   // { verts:[{v,e}], rims:[[o,e]], tris:[[o0,o1,o2]], gone:[t] }
```

- `verts`: write each new overlay vertex's `aPl` and `aN0` (the drawer's own, for vertex `v`) and `aRim = e` into the
  overlay's parked input buffers.
- `rims`: rewrite `aRim` where e fell.
- `tris`: append to the overlay's parked index.
- `gone`: collapse those overlay triangles.
- Caps: 16 k vertices and 16 k triangles. Past the cap nothing is added; the count is in `.dropped`.

**On the GPU** (skin_gpu.js, each posed frame):

- For each drawer with rim places, bind that drawer's place textures and run **one transform-feedback draw of
  `RIDE_VS` over the overlay's input range**. It writes position and normal into the overlay's parked output buffers
  at that range. `RIDE_VS`'s source is unchanged.
- Then **one overlay draw**: the overlay mesh, parked at roll-out with its own small material and compiled with the
  world (`ground_scar.js`'s rule). Its fragment shader is:

  ```glsl
  vec4 c = dlRimBands(vRim, vRest.xz + 0.7 * vRest.yy, uFinish, uSeed);
  if (c.a < 0.5) discard;
  ```

  Draw it with polygon offset over the skin and `depthWrite` false.
- `uFinish`: 0 alclad (the metal skin), 1 fabric (the tubeFabric covering), 2 composite, 3 ply. One value per draw
  range, or a per-vertex attribute.

**What `rim_census.txt` showed.** The rim lands in up to 23 drawers, so B3's per-drawer transform-feedback draws are at
most ~23 tiny calls a frame. The visible draw is one. `rim_events.txt` gives the outer-only counts and the per-frame
`update()` cost.

**Gate.** `check_port.js` RIM:

- the GLSL bands against `rimBandsJS`: 4,000 / 4,000 the same;
- the incremental rim equals the rim computed from scratch after 6 events.

## 3. The in-game before/after stills

`futureDesigns/dmg-looks/looks_stills.js` stages the trunk and nose-over crashes on the real page, on the cloud's
software GPU (`tools/soft_still.js`), and shoots fixed cameras on a frozen frame:

```sh
node futureDesigns/dmg-looks/looks_stills.js --build cub            # BEFORE (master), 3 crashes x 2-3 cameras
node futureDesigns/dmg-looks/looks_stills.js --build cub --after "window.FLYDIY_DMGLOOKS = true"   # + AFTER, the same frame
node futureDesigns/dmg-looks/looks_stills.js --sheet cub            # stills/cub_sheet.jpg, before | after
```

- **A URL switch** (for example `?looks=1`) needs its own boot: `--q 'looks=1' --tag after`.
- **Name the switch.** Tell DMG-LOOKS (through the user) what it is, and the cloud session takes the AFTER set as soon
  as `claude/dmg-looks` is pushed.
- **On the box** (a real GPU), `tools/dmg_wreck_stills.js` with `live_driver.js` is the faster route. Its trunk cameras are
  close to these ones but not identical.
