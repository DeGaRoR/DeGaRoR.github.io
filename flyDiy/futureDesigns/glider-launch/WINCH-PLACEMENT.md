# The winch: placing it permanently at Jolene AFB (2026-11-13)

A0 relayed the user's ask: the glider winch installed **permanently** on Jolene AFB's main runway, 13/31, with the cable
run, so gliders launch from there. These notes are for the session that places it (AFB-0220).

## The asset

| what | where |
|---|---|
| the model (procedural, one call) | `tools/_winch_gen.js`, `window.WINCH_GEN.build(P)` returns a `THREE.Group` |
| its weathering (the club look the user chose) | `tools/_winch_weather.js`, `window.WINCH_WX.apply(group, { macro: WINCH_WX.PRESETS.club, base })` |
| the launch physics | `src/vehicle/winch.js` (GATE WINCH) |
| the page's half | `src/viewer/winch_mode.js` (start chooser `winch:HOME`) |
| the preview | `tools/_winch.html` (bench), `node tools/winch_shot.js <dir>` (stills) |

**Load order:** `src/viewer/matlib.js` (MATLIB makes every material), the gear kit (`tools/_gear_kit.js`,
`tools/_gear_gen.js`, for the van's wheels), `src/viewer/aeroweather.js`, then `_winch_gen.js` and `_winch_weather.js`.
The game bundle already carries matlib, the gear kit and aeroweather; the two winch files are in `MANIFEST.lazy`
(`FLYDIY_LAZY(['_winch_gen', '_winch_weather'])`).

**Build it for the scenery** with `WINCH_GEN.build({ wx: 1, cableLen: 0, chute: 0 })`, then `WINCH_WX.apply(...)` once it
is placed. `apply` takes the placed group's world matrix, so call it after the position is set.
- `cableLen: 0`: no cable lying out. The launch draws the live cable itself.
- `wx: 1`: the weathering, not the generator's plain `wear`, does the ageing.

## Dimensions and frame

**The frame** is the house frame, as every placed prop uses:
- metres, y up;
- the length along **z**: the drawbar at **+z**, the cable leaving at **-z**;
- the origin on the ground under the middle of the deck.

**So face it with -z toward the launch point** (the glider). With the runway's direction from the glider toward the winch
as `(dx, dz)`, set `group.rotation.y = Math.atan2(dx, dz)`.

| | |
|---|---|
| footprint (`WINCH_GEN.KIT`) | L 7.2 m (z, drawbar included) x W 2.3 m (x) x H 3.25 m |
| bounding box, wound in | x -1.45 .. 1.18 (the cab's step on -x), y 0 .. 4.25 (the radio whip; the cab roof 3.02), z -2.97 .. 4.25 |
| deck | 1.00 m up, 5.6 x 2.3 m; the van's wheels, 0.9 m |
| the fairleads (where a cable leaves), local | `(-0.47, 1.36, -2.80)` and `(0.47, 1.36, -2.80)` - `WINCH_GEN.fairlead(group, drum)` gives the world point |
| mass (estimate) | ~3.5 t |

## The cable run and how a launch finds the winch

- **Real practice:** the winch stands at the far end of the strip, with about 1 km of cable laid along it to the launch
  point. On 13/31 (2325 m), put the winch on the centreline, a few metres short of the runway end that is upwind for the
  day's launches. Its -z faces the threshold the gliders line up at.
- **How the launch uses a placed winch:** `winchStart` searches the scene for a group with `userData.winchProp` (every
  `WINCH_GEN.build` result has it). It takes one within **25 m of the centreline** ahead of the glider, with its fairlead
  **300 m or more** away. The cable then runs to that winch; none is built, and it stays after the launch.
  - GATE WINCH's MODULE row tests this: a winch standing 900 m ahead gets a 901 m cable, nothing extra is built, and it
    is still standing after towStop.
  - Without a placed winch, one is set up for the launch at the end of up to 1000 m of cable and removed afterwards.
- **Both runway ends:** one winch serves one direction. For launches either way, place one at each end, each facing its
  threshold.
- **Collision:** the winch has no obstacle record yet. The glider releases about 100 m short of it, but taxiing aircraft
  would pass through it. Give it a box in the obstacle registry when you place it.

## The launch law (built - GATE WINCH)

- **The line** (`src/vehicle/winch.js`):
  - tow.js's tension-only spring-damper, with the far end fixed at the fairlead and its rest length reeled in at the drum
    speed. The stretch rate is `-v_hook . u + v_drum`, and the stiffness is `EA / L`.
  - It is applied per substep through `sim.onSubstep` + `sim.impulse`, with no solver change.
- **The CG hook:** a point 0.25 m ahead of the CG on the belly, the pull shared by the two belly frame stations either
  side of it. On the nose hook the climb cannot hold its pitch.
- **The drum:** 150 kW, a 9 kN force cap, a 350 kg equivalent mass, 32 m/s at most.
- **The driver:**
  1. takes up the slack at 2 m/s;
  2. on the ground run, opens the throttle over 1.5 s, never pulling more than 1.1 x the glider's weight;
  3. in the climb, holds the glider's airspeed at `max(1.6 Vs, 1.15 VClimb)` with a PI, the pull capped at 1.3 W;
  4. eases off once the line passes 50 deg;
  5. brakes after the release;
  6. cuts the cable with the guillotine past 80 deg or 2.2 W.
- **The releases:** the back-release at 70 deg, the line slack at the top, the cable wound in, the weak link (1.6 W), the
  R key.
- **Measured, motorglider with its motor off:**
  - 1000 m of cable: lift-off 3.9 s, the climb at 22-24 m/s, released at **275 m**.
  - 600 m of cable: released at 135 m.
  - after the release, the glider circuit and a landing on the runway.

## Placed (AFB-0220, 13 Nov 2026)

Two permanent winches stand at Jolene AFB, one per direction of 13/31, as editor data in
`tools/fixtures/island_jolene.json` (objects `{ kind: 'prop', key: 'gen:winch' }`; the world editor moves, turns and deletes
them like any prop):

| id | serves | world x, z | yaw | station from 13's end | off the centreline | the fairlead from that direction's start (60 m in from its end) |
|---|---|---|---|---|---|---|
| `xw_winch13` | launches on 13 | -359.51, 136.34 | 0.8552 | 1063 m | 25.5 m NE (the side away from the club and the taxiways) | 1000 m |
| `xw_winch31` | launches on 31 | -209.03, 267.17 | -2.2864 | 1262 m | 25.5 m NE | 1000 m |

- The van's nearest point is 24.0 m off the centreline: 1.5 m off the paved edge (22.5 m), off every normal landing and
  taxi; a DC-3's wingtip on the centreline passes 9.5 m inside it.
- `render_premises.js` `GEN_PROPS` / `buildGenProp` builds it (`WINCH_GEN.build({ wx: 1, cableLen: 0, chute: 0 })`, then
  `WINCH_WX.apply` once placed) and registers it with `hitAdd(g, 'prop', 0.5)`: it collides like every prop. `world_boot.js`
  asks for the two lazy files when the record names `gen:winch`.
- `winch_mode.js` now searches 30 m off the centreline (was 25 m: the van would have stood on the pavement's edge), takes
  only a winch that faces the glider, and takes the nearest of those. From 13's start it finds `xw_winch13`; the 31 winch,
  further down the same runway, is turned away and passed over. The reverse holds from 31's start.
- GATE WINCH `PLACED` holds the record, the pick from both ends, the collision, every material PBR from MATLIB, and the
  page's hooks.
