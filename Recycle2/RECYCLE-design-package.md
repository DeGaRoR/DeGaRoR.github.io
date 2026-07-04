# RECYCLE — Site Design Package

Handoff reference for the next two discussions: **(1) visual styling** of zones, units and connections, then **(2) integration into the game engine**. Everything below is the canonical data model and design guidance. The companion file `recycle-layout.json` carries the exact geometry; `recycle-connect-editor.html` is the working renderer/authoring tool that produced it.

> **Canonical vs. illustrative.** The grid, cell size, layer model, zone geometry, unit dimensions, rotation/placement rules, the port model, the routing rules and the palette are **canonical** — design and engine must honour them. The 30 placed units and 29 connections are an **illustrative reference plant**: in-game the player places units and draws connections themselves. Treat the reference plant as the worked example that proves the system, not as a fixed level.

---

## 1. Coordinate & grid system

- Grid is **22 cells wide × 42 cells tall**, cell size **30 px**, **vertical** (phone-first) orientation.
- Origin top-left. A cell is addressed `[x, y]` with `x` rightward, `y` downward, both integers `0…w-1 / 0…h-1`.
- Unit footprints are integer-anchored; **port anchors and connection points use fractional cell coordinates** (e.g. `5.5`, `8.5`).
- The site is **pannable and zoomable**; nothing assumes a fixed viewport.
- World pixels = cell coordinate × 30.

## 2. Layer model (render order, back to front)

1. **Property** — owned land.
2. **Shell** — the warehouse container.
3. **Zones** — painted floor regions.
4. **Units** — placed machines.
5. **Connections** — conveyors and vehicle routes (drawn under unit boxes so machines sit on top of their belts; among themselves, *last drawn renders on top* at crossings).

## 3. Property

- Owned parcel: **cols 0–18, full height** = 798 cells (`property` in the JSON, as `[x,y]` pairs).
- Cols 19–21 are off-parcel (the ring road sits in 19–20; col 21 is margin).
- Placement is **gated to owned land**; un-owned cells render dimmed. Property is expandable later (buying land is a plausible game mechanic) — keep it data-driven, not hard-coded to cols 0–18.

## 4. Shell — the warehouse

- Footprint: **cols 2–16, rows 10–31** = 330 cells (`shell` in the JSON).
- Cosmetic walls are drawn on the outer boundary of the shell cell-set.
- Functional role: a **placement gate**. Each unit declares whether it must be placed *inside* the shell or *outside* it (see §6).

## 5. Zones (painted floor regions)

Zones are decorative + semantic floor paint. Geometry below is the reference plant's zoning; the **zone _types_ and their meaning are canonical**, the exact rectangles are the example. Rectangles are written `[x0,y0,x1,y1]` inclusive.

| Zone | Role | Base geometry (rects) | Fill | Alpha |
|---|---|---|---|---|
| `road` | Ring road for trucks (off-parcel) | `[19,0,20,41]` | `#6E665C` | 0.82 |
| `truckin` | Inbound truck apron (top) | `[0,0,18,3]` | `#5E6B82` | 0.70 |
| `truckout` | Outbound truck apron (bottom) | `[0,38,18,41]` | `#8A8FA0` | 0.70 |
| `input` | Inbound material drop (input bunkers) | `[2,4,16,6]` | `#46BFB8` | 0.32 |
| `feeder` | Feed line into the sort hall | `[2,10,16,11]` | `#5BCB5C` | 0.32 |
| `baling` | Baler bays (left + right stripes) | `[2,12,3,28]`,`[15,12,16,28]` | `#F2A23B` | 0.32 |
| `bulk` | Bulk-out staging | `[2,29,16,31]` | `#BCE03A` | 0.34 |
| `output` | Finished-goods / dispatch | `[0,35,18,37]` | `#E0A45C` | 0.32 |
| `dirt` | **Drivable internal road** (forklift/loader network) | aprons + L/R margins + bottom strip (see JSON) | `#A98C5E` | 0.78 |

**`dirt` is load-bearing for routing, not just decoration.** It forms a connected ring around the warehouse interior: the top apron (rows 7–9, full width), the left margin (cols 0–1, rows 10–34), the right margin (cols 17–18, rows 10–34), and the bottom strip (rows 32–34, cols 2–16). All internal vehicle paths travel on it. 214 cells.

## 6. Units (catalog)

Seven unit types. `place` = required relation to the shell (`in` = fully inside, `out` = fully outside). `rot` = rotatable in 90° steps (footprint swaps w/h at 90/270).

| Type | w×h | rot | place | Colour | Role |
|---|---|---|---|---|---|
| `input` | 2×3 | yes | out | `#46BFB8` | Inbound bunker (receives from trucks) |
| `feeder` | 1×2 | yes | in | `#5BCB5C` | Feeds the sort line |
| `process` | 1×1 | no | in | `#2F9BE8` | Sorter / processor (the workhorse) |
| `baler` | 2×1 | yes | in | `#F2A23B` | Compacts a sorted stream into bales |
| `bulk` | 3×3 | no | in | `#BCE03A` | Bulk-out staging buffer |
| `output` | 2×3 | yes | out | `#E0A45C` | Finished-goods dispatch (to trucks) |
| `landfill` | 7×3 | yes | out | `#C7E84A` | Reject / residual disposal |

### Port / node model (canonical)

Every unit exposes **four edge nodes**, at the midpoint of each side: top `t`, bottom `b`, left `l`, right `r`. Node coordinates are derived from the footprint (e.g. top node = `[x + w/2, y]`).

For **process** units the roles are read as:
- **top `t` = in**
- **bottom `b` = out** (the main "rest continues" stream)
- **left `l` / right `r` = separated second output** (the ejected/sorted stream)

Not every unit uses all nodes; a unit simply leaves unused nodes unconnected. Node direction is currently **permissive** (the tool does not refuse out→out / in→in) — see §10 for the open decision on enforcing port direction.

## 7. Connections

Two kinds, distinguished by transport medium:

- **Conveyor** — a material belt. Used inside the warehouse and across the input apron (input → feeder). Renders as a chevroned belt.
- **Vehicle** — a loader/forklift move on the dirt road network. Renders as a dashed road route with an arrowhead.

### Routing rules (canonical)

**Conveyors → side-aware orthogonal elbows.** Between the two node anchors:
- both nodes vertical (`t`/`b`) → **Z** with a mid-height crossbar: `p0 → (x0,my) → (x1,my) → p1`.
- both nodes horizontal (`l`/`r`) → **Z** with a mid-x crossbar.
- mixed → **L**, leaving each face perpendicular.
- already axis-aligned → straight.
- Corners are rounded; chevrons indicate flow direction (source → dest).

**Vehicles → dirt-road paths.** BFS (4-connected) through `dirt` cells between the cell just outside the source node and the cell just outside the dest node; collinear points removed; rendered as a **smooth multi-point S-curve** (quadratic through midpoints). **All control points are constrained to dirt cells** — vehicle routes never cross the shell. Optional user "steer" points (`via`) are also held to dirt.

**Crossings.** Connections render in creation order; the one drawn **last sits on top**.

### Connection schema (per entry in `connections`)

```json
{
  "type": "conveyor" | "vehicle",
  "from": { "unit": <index into objects[]>, "side": "t|b|l|r" },
  "to":   { "unit": <index>,                "side": "t|b|l|r" },
  "via":  [[x,y], …],          // optional user steer points (cell coords); [] if none
  "route":[[x,y], …]           // computed dense path the renderer/engine draws (cell coords)
}
```

`route` is the authored geometry — for the engine it is the actual path to animate a forklift/loader (vehicle) or material flow (conveyor) along.

## 8. Palette (locked)

**Surfaces / structure**

| Token | Hex | Use |
|---|---|---|
| board | `#A7C28C` | Meadow ground / parcel |
| whFloor | `#E9E3D5` | Warehouse floor |
| wall / wallDk | `#BCAF99` / `#9C8F78` | Shell walls |
| dirt | `#A98C5E` | Road surface |
| conv / convRail | `#4C4843` / `#6F665C` | Conveyor belt / rail |
| veh / vehDk | `#D08A3A` / `#7E4D1F` | Vehicle route / shadow |
| accent / accent2 | `#F2A93B` / `#3E8E4E` | Marigold / green UI |

**Materials** (for styling belts, bales, output bins by stream)

| Material | Hex |
|---|---|
| PET | `#3FA9F5` |
| Film | `#F7A8C4` |
| Paper | `#E0A458` |
| Steel | `#9FB0C3` |
| Alu | `#C7E9E6` |
| PVC | `#EF6F6C` |

Typeface: **Baloo 2** (500–800).

## 9. Aesthetic direction

Top-down satellite / floor-plan view with a friendly **tilt-shift diorama** feel — "Candy Crush"-adjacent warmth without being childish: rounded unit cards, soft drop shadows, gentle gradient sheen on each box, faint floor grid, warm paper-and-meadow ground. Trucks arrive from the road/apron zones; forklifts move bales along the dirt. The styling discussion owns: per-unit iconography, the diorama lighting/shadow treatment, material-coloured belts and bins, idle/active animation, and how zones read at a glance — all **within this palette and the geometry above**.

## 10. The recorded reference plant (worked example)

30 units, 29 connections. The flow it encodes:

- **Inbound:** 6 input bunkers (top, outside shell) → conveyors across the apron into **3 feeders**.
- **Sort columns:** each feeder drops into a vertical **process** chain; process units eject their separated stream sideways (`l`/`r`) into **balers** in the side bays, while the main stream continues down.
- **Bale dispatch:** balers → **vehicle** (forklift) routes down the dirt margins to the **output** row.
- **Bulk path:** two feeders also run straight down to **bulk** staging; bulk → **vehicle** routes along the bottom dirt strip into the **landfill**.

This validates every rule: conveyor elbows across the apron and between stacked units, side-output L-bends to balers, and dirt-constrained forklift splines that hug the margins. It is the example to design against — **not** a level to ship verbatim.

## 11. Canonical vs. open

**Canonical (do not change without coordinating):** grid 22×42, cell 30, layer order, zone _types_ and meaning, `dirt` as the drivable network, unit dimensions / rotation / in-out placement, four-node port model with process in=top/out=bottom/2nd-out=side, conveyor-elbow + vehicle-dirt-spline routing, last-on-top crossings, palette, Baloo 2, tilt-shift diorama direction.

**Open — for the styling discussion:** unit icons/sprites, diorama shading + shadows, material-coloured belts/bales/bins, zone texture and edge treatment, animation language, selection/hover states.

**Open — for the integration discussion:**
- Fold this layout into the LAYOUT constants the RECYCLE engine + renderer read from (player-authored layouts use the same schema).
- Wire connections into the sim: conveyor material flow + vehicle (BatchVehicle) animation along each `route`.
- **Truck legs:** vehicle routing currently treats only `dirt` as drivable. Truck routes to/from `truckin`/`truckout` need the ring `road` added to the walkable set.
- **Lane offset:** BFS gives the shortest road path but coincident vehicle routes overlap (e.g. the three bulk→landfill runs share the bottom strip). Decide whether to offset parallel routes side-by-side.
- **Port direction:** decide whether to enforce in/out node direction (refuse out→out) or keep free routing.
- **Unit operating modes:** on / off / bypass (bypass = mass-conserving passthrough; off = blocked) when these become engine units.

> **Integration guardrails (NNG):** mass conservation, WYSIWYG simulation, strict engine/UI separation, and **iframe-safe** rendering — no blocking dialogs (`confirm`/`alert`/`prompt`); use toasts + undo.

## 12. Package contents

- **`recycle-layout.json`** — the canonical data: `meta`, `grid`, `cell`, `property`, `shell`, `objects` (30 units), `zones` (9), `connections` (29, each with `from`/`to`/`via`/`route`).
- **`recycle-connect-editor.html`** — the reference renderer & authoring tool (Units + Connect modes; bakes the layout in; exports this exact schema). Use it to see the rules rendered and to re-author.
- **`RECYCLE-design-package.md`** — this document.
