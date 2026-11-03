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

## 2. The change

(section written with the change)
