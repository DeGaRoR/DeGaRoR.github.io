# CONTROL SURFACES — THE AUDIT (2026-09-07, landed as G209)

The user: "I have the feeling the flaps are deploying on the wrong direction,
the ailerons of the jodel with the crank are not moving as they should,
verify that the rudder steers in the right direction, etc. We probably also
need some sensitivity parameters on the joystick inputs. Overall, do an audit
of the control surfaces in every configuration (including the tail)."

Two instruments, both kept in the session's scratchpad and reproducible:

- **The physics**, in node: every archetype baked (`designBake`), built
  (`buildGen`), the aero probe read at 30 m/s along the body with each
  control applied alone — `pitchUp` and `yawLeft` straight off `sim.probe`,
  roll as port-minus-starboard wing lift off `out.dump`, flap as total wing
  lift. The V-tail was probed with `tail.type 'v'` forced into the spec (in
  node the cant is never measured, so the archetype bakes conventional).
- **The visual**, in headless Chrome on `dev.html`: every archetype born
  through `DESIGN_FLOW.bakeBirth` + `GARAGE_SPEC.set`, then
  `CAGE_JOIN.snapshot(export())` read back: for every `surf` part, the
  aft-most vertex turned by the part's own `sgn * k * 0.3` about its `axis`
  (the game's Rodrigues, app.js `surfParts`), and the direction of the
  surface's forward-edge band compared to that axis.

## The frame, once and for all

Model frame: nose **−x**, up **+y**, **+z is PORT** (30_solver `probe()`:
"nose-LEFT yaw = +My (nose −x, +z is the LEFT side)"; right = up × aft).
The cage frame maps to it by model = (−cz, cy, cx): cage +x is model +z, the
port side — _cage_crew says it in words ("pilot's right = −x"). **The cage's
'R' surfaces (`ailR`, `flapR`, `elevR`, the `navR` lamp) are therefore on
the PORT side.** Every sign bug below is that fact, unread.

Solver conventions (00_registry, 40_autopilot, input.js all agree, and the
probe confirmed them on all 25 archetypes):

| control | positive means | measured, every archetype |
|---|---|---|
| `de` | nose up | pitchUp + |
| `da` | roll RIGHT (starboard wing down) | port lift − starboard lift + |
| `dr` | nose LEFT | yawLeft + |
| `flap` | flaps down | wing lift +, pitch nose-down |

## What the visual did before (every cage build)

| surface | drive | old table | trailing edge for a positive drive | verdict |
|---|---|---|---|---|
| elevator | de | sgn +1 about +z | UP | right |
| port aileron (`ailR`) | da | sgn +1 about +z | UP | **reversed** (roll right needs port DOWN) |
| starboard aileron (`ailL`) | da | sgn −1 about +z | DOWN | **reversed** |
| flaps | flap | sgn +1 about +z, k 0.70 | UP | **reversed** |
| rudder | dr | sgn +1 about +y | to STARBOARD | **reversed** (nose left needs TE to port) |
| V-tail, de | de | canted axis, +1 | both UP | right |
| V-tail, dr | dr (drive2) | sgn2 = ±1 by name | port UP, starboard DOWN | **reversed**, and never drawn: app.js `surfParts` did not read `drive2` |
| twin rudders (P-38) | dr | as the rudder | to STARBOARD | **reversed** |

And the hinge: `hingeAxis = (y1−y0) > (z1−z0) ? [0,1,0] : [0,0,1]` — a bare
model axis. On a straight wing the forward edge runs within 3° of z and it
passes. On a cranked outer panel (Jodel: 14° of dihedral, ~6° of plan
taper) the real hinge is **16.7° off** the axis the aileron turned about, so
the surface sheared out of the panel rather than hinging — the user's
"not moving as they should". The rudder on a raked post was 4-8° off too.

## What changed (G209)

- `tools/_cage_join.js` — **`cageSurfHinge(pts, surf, {cant})`**, pure and
  exported: pivot = centroid of the forward 18 % band; axis = the line
  between the band's two ends (along z for every surface, along y for a
  rudder), pointed +z / +y so the signs keep one meaning; drive and sign by
  **side of the pivot**, never by name. V-tail: `drive2 'dr'`, `sgn2 = −1`
  on the port panel, `+1` starboard. The join calls it once per surface.
- `src/viewer/app.js` — `surfParts` carry `drive2/sgn2` and the pose adds
  the second drive (the `moving` path did already).
- `src/core/30_solver.js` — the V-tail panel normal leans **inward**
  (`+ side * sinG * right`) and the rudder mix is `+ side`; the 2026-09-04
  code had the normal leaning outward with the mix negated to compensate.
  Yaw and pitch response unchanged (vtail archetype with the V forced,
  dr 0.3: yawLeft +2352 with the old lines, +2358 with the new; pitch
  identical); the tail's sideslip roll couple now carries the dihedral
  sign (derived from the normals, not measured — the probe reports no roll
  from tail strips), and the drawn ruddervators match the physics.
- `tools/_cage_light.js` — the lamp at cage max.x (the port tip) is now
  RED, min.x GREEN. Since G96 the green lens was on the left wing.
- `src/viewer/input.js` / `input_panel.js` — **sensitivity**: per axis
  binding `gain` (0.05-2, panel 10-150 %), applied after the expo, clamped
  at full travel, centred axes only (a lever's travel is its reading).
  The inferred bindings carry `gain: 1`; `normalise` fills and clamps it.
- Gates: JOIN turns each surface by hand against the physical expectation
  (15 checks, incl. the crank within 1° and the V-tail's two drives, plus a
  V-tail spec probed for yaw and pitch sign); INPUT covers gain (map,
  saturation, lever immunity, profile).

## After

Re-read on cub, cranked Jodel (crankAt 0.45, dihedralOut 14), V-tail
(cant 35) and P-38: port aileron DOWN / starboard UP for da>0; flaps DOWN;
rudder(s) to PORT for dr>0; elevator UP for de>0; V-tail de>0 both UP,
dr>0 port DOWN / starboard UP with both trailing edges to port; the
Jodel's aileron axis within 1.1° of its band (was 16.7°).

## Left open

- The castor (tailwheel) sense was already right and is untouched.
- The generated (`moving`) path in 63_gen_wing keeps its own sign table;
  it was self-consistent before (axis from the hinge points, sgn −1 both
  sides) and no vessel uses it since G184.
- No per-action keyboard rate/travel setting; the keyboard ramps to full.
