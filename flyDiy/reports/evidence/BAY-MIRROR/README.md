# BAY-MIRROR — the sheltered bays reflect like the lakes

The user (3 Nov 2026, via A0): "we would need to treat the bays as lakes for the reflections I think, especially the main
south bay, where the cannery and the hydroplants are".

## 1. Why a bay reads differently from a lake (measured on origin/master adb2d2a9, before any change)

### Where the bays are (Jolene, game metres; -z is north)

Found from the world's own coast field in node (`tools/island_node.js` + a 100 m upwind-fetch sweep, see section 2):

- **The main south bay** — the long fjord that opens south at about z +1500 and runs 7 km north to its head at about
  (-500, -5800). Purple Lake's powerhouse (-174.7, -5780.2) stands at its head; two `big/cannery` buildings (784, -2844)
  and (3004, -2808), the net pens and a trestle pier are inside it. 2.5 km wide; its mouth faces the open sea.
- **Port Chester** — Metlakatla's bay on the west coast: Cedar Harbour's cannery `mk_mw_cannery` (-3081.5, -9059.6) and
  the Port Chester powerhouse (-1141.9, -8313.1) at its head, about x -3200..-1200, z -9200..-8450. Open to the
  north-west only.
- The other sheltered water: the west-coast cove at about (-3700, -5000); the lee of the headlands either side of the
  south fjord's mouth; the bight north of Port Chester (x -4000..-1300, z -10000..-9200, partly sheltered).

### The cause, file:line

A bay is the SEA's water body (body 0): the far plane and the near patch are both tagged sea
(`src/viewer/render_world.js:2946`, `:2978`), so a bay wears exactly the open ocean's surface. A lake is body 1.

1. **The swell's slopes are on every sea pixel, none on a lake's.** `src/viewer/water.js:594` gives the sea
   `wave: 1.0, detail: 1.0, foam: 0.62`; `:596` gives a lake `wave: 0.0, detail: 0.55, foam: 2.0`. The 32 Gerstner trains'
   slopes enter the normal as `wGerstnerS(...) * uWBody[wB].x` (`water.js:285`) — 0 on a lake — and that normal
   (`water.js:364`) is what the planar mirror's lookup walks by (`water.js:438-443`: the reflected ray of the tilted facet,
   capped at 15 % of the view distance). Measured with the world's own trains at the rigs' pinned 5 m/s sea
   (A 0.09 m, L 10 m): the slope RMS is 0.056 (3.2 deg; each reflected ray turns twice that) — the felt band 0.040, the
   wind sea 0.039. A lake: 0. That is the whole difference on the default 'simple' water tier (gamer), where the ripple
   tile, the lifted surface and the whitecaps are off.
2. On the 'full' tier (ultra) the sea adds the ripple tile at 1.0 instead of the lake's 0.55 (`water.js:286`), the near
   patch lifted by the felt band (`water.js:255`), and the whitecaps (`water.js:299`: a lake's foam row 2.0 never breaks).
3. **The mirror's AUTO ring fades the sea, not a lake** (`water.js:1161-1164`): on the sea's plane the weight is
   `(1 - smoothstep(300, 400, eye agl)) x (1 - smoothstep(1000, 1300, distance to land))`; on a lake's plane it is the
   inland dissolve alone. So from 300-400 m over a bay the reflection dissolves to the sky probe while over a lake it stays.
4. **The physics has the same open-sea waves in a bay**: `src/core/20_world.js:819-822` sums the felt trains wherever
   the level is the sea's 0 — a floatplane at the cannery's float rocks on the open ocean's swell.

NOT the cause, measured: the roughness (the sub-pixel slope variance, `water.js:229`) is the wind's law for every body
(0.41 at 5 m/s on a lake and a bay alike), so the mirror's blur is the same; the per-body plane gate `mPlane`
(`water.js:462`) passes a bay (it IS on the sea's plane); the ring's distance-to-land fade is 1 everywhere inside a bay
(no point of either bay is 1 km from land).

## 2. The change: a shelter field from the coastline, one source for the eye and the floats

**The field** (`src/core/28_island.js`, `shelter()` / `calmAt()`): how open the water is, from the island's own coast
bytes. On 100 m cells, the wind's FETCH (the distance it blows over water before reaching a point, which is what grows a
sea) is traced upwind along 16 headings — one semi-Lagrangian sweep per heading, O(cells), the grid's rim open sea — and
averaged: `OPEN = mean(min(fetch, 10 km) / 10 km)`. Measured on Jolene: the open sea 0.6–0.9, an open coast 0.4–0.6 right
at the shoreline, the south fjord 0.0–0.3, Port Chester 0.1–0.2, the west cove ~0.25. `CALM = smoothstep(0.15, 0.40, OPEN)`:
**1 on every open water cell** (96.2 % of Jolene's sea cells are exactly 1 — the open sea is unchanged to the bit), 0 deep
in a bay, a dissolve across the mouth (the steepest step along the fjord 0.195 per 100 m). Land cells take their water
neighbours' mean (6 rings) so the texture's bilinear filter does not lift a bay's shoreline back toward the sea. Built once
on first use: ~35 ms warm, ~90–140 ms cold in node; deterministic (CORE_MATH for the headings). No hand-painted polygons:
any island with a coast field gets its bays for free.

**Calmer, not glassy (A0's ruling, 3 Nov ~22:00)**: the shelter removes the fetch-built sea, not the wind's own ripple. The
waves scale by `waveK = 0.25 + 0.75 x calm` (`28_island.js` `waveK`, the dial `SHELTER.ripple`): 1 on open water, 0.25 deep
in a bay. 0.25 is JONSWAP's height ~ sqrt(fetch): a bay's ~0.6 km against the ~10 km the open sea stands for. The sea's
amplitude is already the wind's (0.018 m per m/s), so the ripple goes glassy exactly when the wind does (GATE WATER 7: the
SEA base keeps 0.026 m of ripple at a 5 m/s sea, 0 in calm air). The mirror ring's bay rule reads the raw shelter.

**One source (WYSIWYG)**:
- physics: `src/core/20_world.js` `waterH(x, z, t)` multiplies the felt trains by `waveK(x, z)` (k = 1 is never
  multiplied, so open water is the same doubles). Floats, the hull's hydro, the spray's water level and the buoys all read
  `waterH`, so they ride the calmer bay;
- the eye: `render_world.js` hands `world.calmField()` (the same bytes and dial) to `WATER.setCalm`, an R8 texture
  (`uWCalm`, texel centres at the cells' centres, clamped like the core). The near patch's lift is multiplied by it (the
  hull sits in the wave it is drawn in); on the sea's body the fragment blends the per-body row toward the LAKE's
  (`mix(uWBody[1], uWBody[0], waveK)`: the swell's slopes x waveK, the ripple tile toward 0.55) and thins the whitecaps'
  cover by waveK; the ripple dial reaches the shader from the field itself (`uWRipple`). The colour, the depth, the shore and the roughness law stay the sea's;
- the mirror: no second capture, the same plane. Over a bay the AUTO ring's weight takes the lake's rule by the bay's own
  weight (`water.js` mirrorRender: `sea + (1 - sea) x bay`, bay = 1 - calm at the eye): no 300-400 m fade and no
  1.0-1.3 km fade over a sheltered bay; open water (calm 1) exactly as before. After the `'off'` return, so reflections
  off still costs nothing on the CPU.

**Cost**: one R8 texture sample per sea fragment and per near-patch vertex (every tier, the waves are not a reflections
setting), a 121 KB texture, the field's one-time build. The water program's own samplers: five now (GATE WATER's row).
Counted off the linked GL program on SwiftShader (`bay_stage.js`, G424's rule): master's water program uses 8 texture units
with the hull reflection (uWSdf, uWDetail, uWInter, uWHull, uWMirror, envMap, uApAtlas, dfgLUT); this branch adds uWCalm
(9 - the hardware floor is 16; the after run's count is in `after.json`).

## 3. The floats on the calmer bay: the take-off run at the SEA base, master vs this branch

The game's own seaplane base `SEA` (360, -3660) lies inside the south fjord (calm 0, waveK 0.25); Cedar Harbour's `mk_sea`
and `cb_sea` are on open water (calm 1, unchanged). The floats Cessna (`bugReports/cessnaFloatsWOrks.json`, 1017 kg) flown
down SEA's lane from 600 m short of its centre, no air wind, the sea pinned, with `tools/hydro_trim_table.js --world jolene
--at SEA --sea A,L,dir` (new option; `--core` the master worktree's core for the before):

| sea | technique | master | this branch (the bay, waveK 0.25) |
|---|---|---|---|
| 5 m/s (A 0.09, L 10) | G3390 rig | 26.9 s, 458 m | 26.6 s, 455 m |
| 5 m/s | POH | 21.7 s, 292 m | 21.4 s, 291 m |
| 8 m/s (A 0.144, L 14.2) | G3390 rig | 27.3 s, 456 m | 26.7 s, 457 m |
| 8 m/s | POH | 23.1 s, 310 m | 21.5 s, 293 m |
| calm (A 0) | both | 26.5 s, 451 m / 21.4 s, 293 m | identical |

The floats unstick the same on the bay; the one difference past a few metres is the POH run at 8 m/s, 17 m shorter on the
calmer water (master's tracks drift 3-9 deg off the lane in the open-sea waves; the bay's hold within 2-3 deg).

## 4. Gates (node; this tree's build, `--no-build`)

The brief's set: **WATER, GFX, FLOATS, SEAPLANE, HYDRODYN, UISMOKE, UISMOKE-PHONE: PASS**. There is no SPRAY gate in the runner -
the spray's rows are GATE WATER section 6 (PASS).

The gates that read the touched files (`water.js`, `render_world.js`, `20_world.js` / `28_island.js` through the island,
`waterH`): **PASS** - SIMWORKER, HYDRO, WETFX, WETFX-PAGE, WIPLINE, CLIMATE, WORLDRENDER, UILAYER, SHADOWSKY, MEDIA, SITE,
TESTFIELD, METKIT, AUDIO, STRIPGROUND, FLIGHTREC. **RED, and red on a clean origin/master adb2d2a9 with the same rows**
(the master worktree, the same session):
- TOUR: the aluminium C172 ground-loops landing at tw_ski (2 of 4 legs);
- DESTTO: ltd:floats' leg 2 gives up its roll-out at mk_sea after 811 s (the same event times on both trees; the gate's
  island has no sea state - A 0 - so `waterH` returns before the shelter is read: this change cannot reach it);
- VEHICLE: DEF / AIRBORNE; LAKEBED: 02/20's pond rows 2 and 3; WORLD: island approaches 13/31 under 4 %;
- ASSETS: the `new THREE.*Material` counts (render_premises, app, hangar_view, studio, dmg_members - files not touched here);
- PARKED: node's heap out of memory building the parked aeroplanes (on master too).

## 5. The pictures (SwiftShader, `tools/soft_still.js --stage tools/perf/bay_stage.js`)

Before = a clean origin/master adb2d2a9 worktree's own `soft_still.js` + `index.html`; after = this branch's `index.html`
(built, not committed). The software rung's potato preset with the reflections row set to AUTO and the water tier 'simple'
(gamer's) by the stage, the floatplane `bugReports/cessnaFloats.json`, the sea pinned at the rigs' 5 m/s (A 0.09 m, L 10 m,
dir 0.4), the run paused, 1280 x 720. One run at a time with the machine to itself (a run sharing the CPU with the gates timed
out at the garage). Never read a frame time off SwiftShader. `before.json` / `after.json` hold each view's eye, the
aircraft, the mirror's state and the calm factor.

The water's ripple ridges, measured on the stills (mean |dL/dy| of the luma over the water rows; the whole frame's mean
|difference| between the two):

| view | mirror weight before -> after | calm at the aircraft | ridges before -> after | frame diff |
|---|---|---|---|---|
| `sbay_float` the main south bay afloat, eye 6 m up, up the fjord | 1 -> 1 | 0 | 1.70 -> 1.17 (-31 %) | 1.14 |
| `sbay_300` the same fjord from 300 m | 0.35 -> 0.52 | 0.055 (the eye over the lower fjord: 0.52) | 1.97 -> 1.75 (-11 %) | 0.29 |
| `pchest_float` Port Chester afloat | 1 -> 1 | 0.023 | 1.25 -> 0.98 (-22 %) | 2.34 |
| `lake_float` a drawn lake (the comparison) | 1 -> 1 | - | 1.21 -> 1.20 | 0.03 (JPEG noise) |
| `open_float` the open sea 3 km off the west coast | 0 -> 0 | 1 | 1.46 -> 1.45 | 0.02 (unchanged) |
| `open_300` the same open sea from 300 m | 0 -> 0 | 1 | 1.03 -> 1.03 | 0.00 (unchanged) |

- `pair_sbay_float.jpg`: the bay's ridges calm to the lake's level (1.17 against the lake's 1.20) and the floatplane's
  reflection is one image instead of torn strips; a long low ripple stays - A0's wind ripple (waveK 0.25), so the bay is a
  calmer sea, not a glass lake, by design.
- `pair_sbay_300.jpg`: the mirror's weight 0.35 -> 0.52 (the eye stands over the fjord's lower half near the mouth, where the
  lake rule is partial); the water from this height reflects mostly sky either way, so the change is slight.
- `pair_pchest_float.jpg`: Port Chester calmer (-22 %), the hillside's reflection steadier.
- `pair_lake_float.jpg`, `pair_open_float.jpg`, `pair_open_300.jpg`: unchanged (the lake is not the sea's body; the open sea
  is calm 1, and the AUTO ring keeps it off 3 km out as on master).

The water program's texture units, read off the linked GL program on both runs: master 6 / 8 (without / with the hull's
reflection), this branch 7 / 9 (+ uWCalm).
