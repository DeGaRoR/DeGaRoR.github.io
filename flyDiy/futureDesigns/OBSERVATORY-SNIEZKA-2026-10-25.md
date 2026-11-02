# THE ŚNIEŻKA OBSERVATORY — a landmark generator (2026-10-25, not landed)

The user, with six photographs: "This is the Sniezka meteo station. It's
perfect for flyDiy. Can you give your best shot at modeling this building?
Only the geometry for now and placeholder materials, the real ones would use
the in-game library ... use the methods of the houses and weathering of the
mine. It does not have to reproduce exactly, but the feel, the main features
and the quality should be there, including a good amount of detail."

**Status: written, on the house bench, NOT committed** (shared tree; no G
number taken). Files:

- `tools/_observatory_gen.js` — `window.OBSERVATORY_GEN`, the generator API
  every building generator has (DEF / ROWS / PRESETS / BAGS / MAT / build /
  applyFinish / makeFinish / catOf / CATALOGUE, plus `plan()` and
  `randomObservatory()`).
- `tools/_house.html` — five one-line edits: the script tag after the towers,
  `const OB`, `observatory: OB` in GENS, OB in the generic checks, OB in the
  dice. Open the bench, category **landmark**, presets
  `Śnieżka observatory` and `Śnieżka 1974`.

## What it is

Wysokogórskie Obserwatorium Meteorologiczne, Śnieżka (1603 m), Lipiński and
Wawrzyniak, 1966-1974. The sources give three discs of about 13, 20 and 30 m
on a central concrete core; the photographs give the rest. Frame: the
two-tier disc's centre is the origin and its floor the datum, +z the front
(the south, the classic view), metres.

| part | as built | from |
|---|---|---|
| two-tier disc | eave R 10.3; rubble storey 3.3 m (R 8.1, 45 cm wall, 40 facets); copper skirt flaring 1.7 m to the lip; window band 2.05 m (44 bays, transom at 0.8); copper edge; tar cone rising 1.7 m to a lantern | photos 1, 3, 4, 6 (the car gives the storey) |
| flat disc | eave R 14.5 at (-19, -8); rubble plinth; floor-to-eave glazing (60 bays, the south bay a glazed double door); flat cone rising 2.1 m; lantern; skylight hatches, mushroom vents, a louvred box | photos 1, 3, 4 |
| the core | elongated octagon 7.2 x 4.8 m at the foot, battered to 78-80 % at the top, long axis along x (narrow end-on, broad from the flank — as the photos disagree); cladding battens; framed slit windows; at (-7, -11.5), rising from the junction | photos 4, 6 |
| top saucer | R 7.0; underside 30° from the core (R 3.05) to the rim, 2.4 m drop, apex at 10.6 m; gallery and rail; window band 1.9 m set back 1.9 m (22 bays); roof cap; railed roof deck | photos 4, 5, 6 |
| the roof deck | mast (6.6 + 2.6 m, crossarms, stays, red obstruction light on the switch), anemometer and vane, two Stevenson screens, ceilometer, rain gauge, five rail-clamped sensors, hatch, steel stair from the gallery with a landing | photos 2, 5, 6 |
| roofs | radial battens on the vertex lines, a quilt of repair patches on the membrane, rusty flues, galvanised vents, a tall square clad stack with its antenna | photos 3, 6 |
| summit | the concrete triangulation pillar (5.8 m, battered, formwork joints, stones at its foot) | photo 6 |

Junctions are solved by construction: the flat disc's roof passes 7 cm under
the skirt where it meets the drum; a glazing bay is dropped only when both its
corners are buried (in the drum or the core), so no seam opens; drum openings
are suppressed where the wall is inside the flat disc or the core.

## How it is built

The kit through `face()` (winding by construction, UVs in metres). Every disc
is a REVOLVE of its section; each conical run is mapped by DEVELOPMENT (ρ from
the cone's apex, φ = θ·sin(half-angle)), so a scan lies on a cone isometrically
with one seam per ring; normals are the surface of revolution's own (smooth
round, crisp at every fold). The drum is the kit's `wall()` per facet with the
arc length carried round (the kit restarts u per panel); its openings are the
house's `dressOpening` / `buildDoor` / lamp. Window bands are the house's
reflective glass (glow, window size for the shader) with the room behind in
the far-pane bag, varnished frames and dark structural mullions. LOD 1 is the
same numbers with coarser rings and no seams, frames, mid-rails, patches or
small instruments.

Measured in the bench rig: **36.3 k tris near / 6.1 k far** (17 %), ~0.3 s for
the near build with the occlusion bake; no NaN, no degenerate triangle, both
presets, both levels.

## The finish (placeholders, from the library where it has something)

The house's finish (shadeHouse: the dirt line, the baked occlusion, the
repetition breaker) and the mine's weather: G329's cloud fields on the copper,
the dark sheet, the core, the rubble and the pillar, the roofs in their own
greyed-dusty mode, G342's steel mix on the structural steel. Two hooks of its
own, chained after those: RAIN STREAKS (a noise stretched along y, read in
world space so it runs over every facet; pale on the dark sheet, dark on the
copper) and RUBBLE (3-D Worley cells flattened to slabs, a tone per stone, dark
joints, a bump at the joints through the screen derivatives). Every own slot
has its own `customProgramCacheKey` (the chains differ, the outermost hook's
source does not).

| slot | stands in with | wanted from the library |
|---|---|---|
| roof, patch | `render` in charcoal, matte (its roughness map dropped) | a bitumen / tar-paper membrane scan |
| stone | `concretec` + the rubble hook | a dry-laid schist rubble scan (dark grey-green slabs) |
| copper | `galv` in seafoam, metalness 0.3 | a patinated copper sheet scan |
| shaft | `concrete` in charcoal | slate / fibre-cement cladding panels |
| dark | `steelgrey` in charcoal | painted steel, weathered (the set may do) |
| steel, rail, flue, conc, deck, paint | `steelgrey` + steel mix, `galv`, `rust`, `concrete`, `render` white | as is |

1974 preset: aluminium (`galv`) on every disc and the underside, rendered
panels with cover strips at the foot, a round ribbed light core, light frames.

## Owed

- Not in `tools/build.js` / the game: no catalogue registration with the
  premises editor, no placement. Zero blast radius until someone adds it.
- No gate: GATE HOUSE does not load it (a row for its catalogue and a
  near/far silhouette check would be the start).
- The door leaves are drawn by the house's `buildDoor` in the trim slot, so
  they take the varnished-frame colour; the photographs show dark doors.
- The summit around it (dry-stone walls, granite setts, the chapel) and the
  red rope fences are not drawn; LOD 2/3 not built; no collision shape.
