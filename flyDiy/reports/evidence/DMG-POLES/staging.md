# DMG-POLES — the staging, to replay on the box for the stills

Every case is `tools/_dmg_poles_lib.js` `staging()` → `_treecrash_lib.js` `atTrunk()` / `flyRun()`. Nothing else is
set; the numbers below are the lib's own.

## The world
- The flat world at **300 m** (`flatWorld(300)`: `terrainH = 300`, no obstacles, no woodland, calm air: `W.wind` unset).
- The home strip's heading; the aeroplane placed by `placeAtAerodrome` at the strip's spawn.

## The aeroplane
- One of the validated builds, loaded as the game loads it (`_load_build.js` `loadValidated`):
  `cub` = `builds/cub_2026-09-20_corrected.json`, `jodel` = `builds/jodel_2026-09-20_corrected.json`,
  `metal` = `bugReports/cessnaMetal (1).json`.
- **Damage on, the certificate stamped** (`?damage=1` in the page; in node `FLYDIY_CERT=1`).
- **Throttle 0** from the start (`sim.ctl.thr = 0`); no pilot; controls neutral.
- **On the wheels** (taxi, lift-off speed): settled for 120 frames (2 s) at the stand, then every node is given the
  speed V along the strip's heading.
- **In the air** (35 m/s): placed with no settle, then `levelPose`: pitched about the CG until the body's x axis is
  level, then lifted so its **lowest node stands 2.0 m over the ground**; every node given 35 m/s along the heading.
- Stepped at 1/60 s frames (the sim's own substeps) for **6 s**.

## The poles
Two vertical cylinders in the world's tree hits (`world.treeHits`, set key `'fill:test'`, stride 5:
`[x, z, y_foot, r, y_top]`), **10 m ahead of the CG** along the heading, each at a lateral station `s` from the
aeroplane's centreline, `+` toward the **right wing** (the def's +z: the side its `...R` nodes stand on), foot on the
ground (y 300), top 9 m up (y 309).

| pole | r (m) | Ø | height |
|---|---|---|---|
| wood (a wooden distribution pole) | 0.13 | 26 cm | 9 m |
| steel (a steel lighting / sign pole) | 0.06 | 12 cm | 9 m |

Pole stations `s` (m) = fraction × semispan, the asymmetric rows with the aeroplane **0.5 m right of the gap's
centre** (right pole at `f·semi − 0.5`, left at `−(f·semi + 0.5)`):

| build | semispan | V lift-off (ap.VRot) | 85 % | 65 % | 45 % | 65 % + 0.5 m right (R / L) |
|---|---|---|---|---|---|---|
| cub | 5.35 | 15.9 m/s | ±4.547 | ±3.478 | ±2.407 | +2.978 / −3.978 |
| jodel | 4.15 | 18.7 m/s | ±3.528 | ±2.698 | ±1.868 | +2.198 / −3.198 |
| metal | 5.50 | 22.2 m/s | ±4.675 | ±3.575 | ±2.475 | +3.075 / −4.075 |

Speeds: **taxi 8 m/s**, **lift-off = the build's `ap.VRot`**, **air 35 m/s 2 m up (levelled)**. First contact at
3.27–3.30 s (taxi), 2.45–2.63 s (lift-off), 0.28–0.30 s (air) after the start.

## Replaying one case
```
node -e "process.env.FLYDIY_CERT='1'; const PL=require('./tools/_dmg_poles_lib.js');
  const A=PL.analyse(PL.run(PL.caseOf('cub/wood/air/0.65'))); console.log(JSON.stringify(A.wings.R, null, 1))"
```
Case names: `build/pole/speed/fraction[/offset]`, e.g. `jodel/steel/lof/0.45`, `metal/wood/taxi/0.65/0.5`.
`atTrunk`'s `every: N` option records the beams top-down every N frames (the lib's `frames`) if a 2-D picture helps.

## For the box's stills (dmg_wreck_stills.js stages one trunk)
Stage the two trunks instead of one: on the home strip, `world.treeHits.set('fill:test', [xR, zR, elev, r, elev + 9,
xL, zL, elev, r, elev + 9])` with `(x, z) = CG + 10 m · heading + s · right`, `right` the aeroplane's def +z laid flat;
the aeroplane as above (`?damage=1`, the throttle shut). Suggested stills (the gate's key rows): `cub/wood/air/0.65`
(strut-braced: the panel off with its strut), `jodel/wood/air/0.65` (cantilever: the outer panel off at the crank's
bay), `metal/wood/taxi/0.85` (the tip bay off at walking-plus pace), `cub/wood/lof/0.65/0.5` (asymmetric: the right
wing loses 20 kg, the left 8 kg; the aeroplane yaws ~12° toward the right).
