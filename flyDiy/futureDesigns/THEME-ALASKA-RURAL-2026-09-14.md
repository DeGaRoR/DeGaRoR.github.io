# THEME: ALASKA RURAL — the asset pack sorted into categories
### (2026-09-14, the assessment; the user: "group what we've done by themes, and within themes, categories")

A THEME is a set of building and scenery assets that belong to one place. Inside a theme
the assets fall into fixed CATEGORIES, and each category has ONE placement law:

| category | placement law | who places |
|---|---|---|
| Residential | ZONED (plots sown along roads, a density dial) | the composer |
| Commercial | ZONED | the composer |
| Industrial | ZONED, plus dedicated sites | the composer / by hand |
| Landmarks & decoration | BY HAND | the editor |
| Institutions | BY HAND, and the game KNOWS the role (town hall, police, fire, school, clinic, church, lighthouse) | the editor |
| People & animals | SCATTERED procedurally + by hand on top | the composer / the editor |
| Airport buildings | BY HAND on a strip (small and medium aerodrome) | the editor |
| Static vehicles | SCATTERED (parking, yards, roadside) + by hand | the composer / the editor |
| Poles & fences | PLANTED along a polyline | the editor |

This document is the first theme's inventory against those categories: what exists, in
which generator or prop table, and what is missing. It is written from the code on
2026-09-14 (tip `85531e0d`): `tools/_house_gen.js` (28 presets), `tools/_big_gen.js` (9),
`tools/_shed_gen.js`, `tools/_tram_gen.js`, `tools/_totem_gen.js`, the three prop tables
(`props_table.py` 45 rows, `pier_table.py` 49, `totem_table.py` 6), the six Mixamo crew
in `src/chars/`, and the hangar family in `src/viewer/hangar.js`.

Bench: the HOUSE bench `tools/_house.html` (launch `flydiy-house`, port 8355) already
carries the model switch house | shed | big building, and it is where the institutions
get modelled (they are HOUSE_GEN / BIG_GEN presets like the church and the town hall).
The PREMISES bench (`flydiy-premises`, 8401) is where the placement laws get exercised.

---

## 0. THE CAR POLYCOUNT (answered first, the user is going shopping)

The number that matters is not triangles — the decimator (`tools/prop_lod.js`) already
cuts every car by SHARE (`car: [[0.25, 2500, 15], [0.06, 700, 45], [0.015, 200, 120]]`) —
it is MATERIALS. The premises showcase measured 4551 draw calls at the overview
(`premises_perf.js`, G380); the Buick came in at 29 materials = 29 draws per car.

Target per vehicle, as delivered:

| | target | hard cap | why |
|---|---|---|---|
| triangles | **5 000 – 12 000** | 20 000 | 8k base -> 2.5k @15 m, 700 @45 m, 200 @120 m through the existing LEVELS; a 4.5 m car is ~100 px long at 30 m on a 1080 view |
| materials | **1** (body + glass on one atlas) | 2 | draw calls are the budget, not vertices |
| textures | one 1k atlas (albedo + normal + arm) | 2k source is fine, `tex` bakes it down | the baker never upscales; keep the source |
| interior | none, or a baked-dark cabin under tinted glass | — | never seen from the air |
| wheels | part of the one mesh | — | static; nothing turns |
| scale | real metres, y up | — | the baker re-origins (`place: 'floor'`) but does not rescale a guess |

Traps already met, so the rows fix them at bake time (`pier_table.py` per-row `slots`):
Sketchfab exports lie about metalness (`metallicFactor 1` over a white map = chrome —
`slots: {mat: {metal: 0.1}}`, `metalCap`); KHR_materials_transmission on things that
are not glass (`opaque`); origin in centimetres (`scale`).

What Alaska rural wants (the theme, not a catalogue): old and new PICKUPS first
(3-4: an F-150/Silverado-era body, a square-body, a modern crew cab), a SCHOOL BUS,
an SUV (Suburban/4Runner class), a beat-up VAN, an ATV/quad, a SNOWMACHINE, a boat on
a trailer (have `boat_tirola`), a FUEL BOWSER and a small TUG or tractor for the
aerodrome, and one or two sedans. 10-14 vehicles. The seven abandoned cars we have
are the derelict end of the range and stay; these are the ones that drive.

---

## 1. RESIDENTIAL — zoned (HOUSE_GEN presets, `tools/_house_gen.js`)

| preset | notes |
|---|---|
| shore cabin | the base house |
| village house | 2 storeys, the sampler's default |
| modern dark | |
| saltbox farmhouse, saltbox cottage, hip cottage | |
| gambrel barn | (also reads as agricultural) |
| log cabin | crossed-log corners (G236) |
| over the water | piles, jetty, the waterfront house |
| bunkhouse | (mine row; residential form) |
| mine cottage | |
| outhouse, garage, storage shed, woodshed | outbuildings (`outbuilding: 1`), placed by plot area |
| `_shed_gen.js` | plank-by-plank shed, `shake` dial |

Dressing already attached to a residential plot (`VILLAGE_GEN.finishPlot`): fence + gate
leaf, lot ground patch (5 splats), path, deck furniture, bins, bags, junk, an abandoned
car in the backyard, a boat, the woodpile, the water butt, the wall lamp, curtains,
smoke. **Complete for zoning.** The density dial is the composer's `makePlots`
frontage + gap: `plotMin/plotMax/gap` per kind (`KIND_RULES` in `27_premises.js`) —
a `density` in the zone record maps onto those three numbers. Not built yet: the
FRONT LOT (parking alley + the driving cars, queued since G303).

## 2. COMMERCIAL — zoned (BIG_GEN, `tools/_big_gen.js`)

| preset | notes |
|---|---|
| store | parapet sign slot |
| cafe | canopy fascia sign |
| motel | strip of doors |
| boat shed | (commercial/marine) |

Plus the BILLBOARD pipeline (`assets/billboards/` -> `sign_import.py` -> `SIGN_TEX`):
roadside boards on posts, and the `signKey` slot on every big building. **Thin.** A
commercial zone in a village of this size wants: a GAS STATION (canopy + pumps +
kiosk; the pumps are props), a GENERAL STORE with a porch (the store is a warehouse
with a parapet), a BAR/ROADHOUSE, a LODGE, a small OFFICE (air taxi / tour operator —
the billboard sheets already name these). Density: one zone kind `commercial` with
wider frontages and open yards (`placeBig` already opens a yard).

## 3. INDUSTRIAL — zoned + dedicated sites

| what | where |
|---|---|
| warehouse, cannery, workshop, mine shop, tram shed | BIG_GEN |
| cannery shed, fish shack, net loft | HOUSE_GEN (marine-industrial, waterfront) |
| kennecott mill (tiers, tower, crusher, conveyors, stacks, receiving house) | HOUSE_GEN `buildMill`, a `complex` catalogue entry |
| tram top / base station + the moving tram | `_tram_gen.js`, cable hooks |
| pier kit (7 modules), piles, lamps, harbour kind | `pier_table.py` + `pierPlan` |
| yard clutter: pallets, cinder pallet, cement bags, drums, jerrycans | pier yard group + hangar vessel group |

**Good.** Missing for the zone: a FUEL DOCK / TANK FARM (cylindrical tanks on a bund —
this is also the aerodrome's fuel), a SAWMILL (open-sided shed over a log deck — the
`openFront` shed at scale), a FISH PROCESSOR (= cannery, exists). Dedicated sites are
placed by hand through the premises catalogue (the mill, the tram already are).

## 4. LANDMARKS & DECORATION — by hand

| what | where |
|---|---|
| totem park (6 poles, half circle, boulders, lawn) | `_totem_gen.js`, `TOTEM_KIT`, park kind |
| the tram (towers, cable, the moving car) | `_tram_gen.js` |
| flagpole (+ flag) | `buildFlagpole` (town hall / church) |
| billboards | BIG_GEN `billboard()` |
| picnic table, planter, benches (stool/chair), lamp_wall | pier yard |
| boats x7 (moored / on trailer) | pier boat group |
| pier lamps, street lamps on poles | `buildPierLamps`, `planPoles` (G370) |

Missing: a WATER TOWER (Alaska rural staple, and a VFR landmark — this is the one to do
first), a RADIO MAST / antenna farm (guyed, red-white, a landmark on approach), a
CEMETERY (fence + crosses, a church wants one), a MEMORIAL/statue plinth, a BOAT RAMP,
a BRIDGE (the road network will need one). The lighthouse is in §5.

## 5. INSTITUTIONS — by hand, the game knows the role

The game must be able to ask "where is the fire hall" — so each of these is a catalogue
entry carrying a `role` tag (`tags: ['institution', 'police']`), one keeper.

| role | status | what it is in this theme |
|---|---|---|
| town hall | **have** (`town hall`, hall widest land plot, flagpole) | |
| church | **have** (`church`, `village church`, `chapel`, belfry) | |
| school | **missing** | long single-storey with a gym block (higher roof), a flagpole, a fenced play yard, a bus loop out front |
| police / public safety | **missing** | small hip-roofed building, a sign, a bay for the truck; in a village this is one building with the VPSO |
| fire hall | **missing** | metal building, two roller doors (BIG_GEN has `doors`), a hose tower, a siren pole |
| small hospital / clinic | **missing** | hip cottage with a covered ambulance entry, ramp, red cross sign |
| post office | **missing** (not on the user's list, but every Alaskan village has one — cheap: a store variant with the sign) | |
| lighthouse | **missing** | an octagonal timber tower on a keeper's house (Eldred Rock / Point Retreat class): shaft, gallery rail, lantern room with GLOWING glass (`aHouseLit` channel exists) and a rotating beam at night (`stats.lit.lights` slot exists); a `light` hook so the nav layer can list it as a beacon |

Order of work (mine): fire hall (BIG_GEN, the roller doors exist) -> school (composite:
`buildComposite` joins two house volumes; the gym is a taller hipped block) -> clinic
(hip cottage + canopy + ramp) -> police (small, sign) -> lighthouse (the only NEW
primitive: a tapered octagonal shaft with a gallery — `_house_kit.js` gets `tower()`) ->
post office. Each is a preset in the house bench, each gets a GATE HOUSE battery rule,
each publishes its `role`, its sign slot and its lights. Signs: the institutions use the
sign pipeline (`assets/billboards/`) with a `civic` kind — the user's sheets, alpha-cut.

## 6. PEOPLE & ANIMALS — scattered + by hand

| what | where | cost |
|---|---|---|
| 5 static BlenderKit people (andrew, john, charles, luke, koky) | pier people group, LODs 24k/5k/1.2k | delivered 129-355k tris; the decimator carries them |
| 6 Mixamo crew (ch01, ch02, ch20, ch22, ch42, remy) | `src/chars/`, rigged, IK-posed | crew only; figurants gated on the texture-budget ruling (G246) |

**No animals.** The theme wants: DOGS (sled dogs staked in a yard, a dog in a truck bed),
MOOSE (the Alaska landmark animal, and a runway hazard the game could use), BEAR
(black/brown, at the dump), BALD EAGLE (on a pole top), RAVENS, GULLS (harbour), a few
CARIBOU. Static poses are enough at first (same pipeline as the people: prop rows +
LODs). Budget per animal like a person: <=30k delivered, one material; the decimator
does the rest. Scatter law (to write): people near doors, docks and the store; dogs on
residential lots; eagles on the tallest pole; gulls on the harbour; moose at the
forest edge and on the strip at dawn.

## 7. AIRPORT BUILDINGS — small and medium aerodrome

| what | status |
|---|---|
| club hangar (steel portal, 15 x 12.5 x 7) | **have**, interior + `opts.exterior` shell |
| field shed (timber, 7 x 9 x 3.6) | **have** (`shell: 'field'`, FRAME timber) |
| works (20 x 20 x 9.5) | **have** as dims on the portal (HANGARS.md S4) |
| windsock, boundary fence, tie-downs, PAPI, apron, stand | `25_airfield.js` (drawn in `render_world.js`) |
| clubhouse, second shed | BOXES (`AIRFIELD_SITE.buildings`) — placeholders |

The three shells exist but only ONE is drawn in the world (the site's hangar), as a full
exterior build (264 ms, 18.4 MB — hangar.js:40). What "proper exterior models for the
three sizes" needs: (1) a `hangar/field|club|works` CATALOGUE entry (kind building,
foot from HW/HD, a `door` hook the stand/taxi solver reads, `role: 'hangar'`) whose
build is genHangarBuild's exterior with the interior-only work skipped (the two shadow
bakes, the cube pass, the fit-out), (2) the exterior BUILT ONCE per shell key and
INSTANCED — a medium aerodrome has 6-10 hangars, (3) an exterior LOD (the shell as a
box with the same tile at 300 m — the impostor ladder exists for trees, a hangar is
easier). Then the rest of a small/medium aerodrome as BIG_GEN/HOUSE_GEN presets:
TERMINAL (a store-sized building with a canopy and the sign), FBO / FLIGHT SERVICE
(hip cottage + a tower cab on the roof), CONTROL TOWER (medium only: cab on a shaft —
the lighthouse's `tower()` primitive serves both), FUEL FARM (the industrial one), AWOS
mast, beacon tower (rotating — the beacon light rule G96-G99 applies), T-hangar row
(a works shed with a saw-tooth of doors), tie-down rows, a fence with the gate (§9).

## 8. STATIC VEHICLES — scattered + by hand

Have: 7 abandoned cars (derelict), `car_covered` (in the hangar), `boat_tirola` on its
trailer. Want: §0. Scatter law: `planCar` exists for a lot (backyard, garage); the FRONT
LOT / parking alley is the queued piece; the aerodrome gets a car park by the terminal
and the bowser on the apron; commercial gets a lot in front.

## 9. POLES & FENCES — planted along a polyline

| what | where | drawn or prop |
|---|---|---|
| picket fence (kit beams, wornwood, AO) + gate bay + gate leaf | `buildFence`, `gateLeaf` (village) | drawn |
| old picket fence 4.6 m (Sketchfab) | `fence_old` prop | prop |
| airfield boundary fence (posts + rails) | `render_world.js` off `SITE.fence` | drawn, hangar-local |
| utility poles x3 (transformer / plain / one transformer) | pier yard `pole_a/b/c` (26-35k tris each, 2 mats) | prop, LODs |
| street lamp arm on a pole | `planPoles` (G370) | drawn on the prop |
| billboard posts | BIG_GEN | drawn |
| tram towers + cable | `_tram_gen.js` | drawn |
| totem park fence | `TOTEM_KIT` | drawn |

Missing: CHAIN-LINK (the aerodrome and the school yard), a WIRE FENCE (cattle/moose:
posts + 3 strands), GUARDRAIL (the road), a HEDGE/windbreak row, and the CABLE between
utility poles (the poles stand alone today — a catenary between consecutive poles is
what makes a line read). And the tool: **PLANT** = an editor polyline tool that lays a
chosen kind along the line at its pitch (fence panels mitred at the corners, poles at
`step`, cable as catenaries between them, a gate where the line crosses a path) —
`27_premises.js` gets a `line` feature kind beside roads/zones/sites; the composer
builds it through one `LINE_KITS` table. The three utility poles should go through
`prop_lod.js` harder (26-35k for a pole seen from 100 m is the delivered scan, not the
need) — or be REDRAWN as kit beams (a pole is a tapered cylinder and two cross-arms).

---

## 10. THE MISSING LIST, in the order to build it

1. **Institutions** (§5): fire hall, school, clinic, police, lighthouse, post office — presets + `role` tags + signs. *Landed 2026-09-14 as G392 (institutions, signs, tower, wing, sports grounds).*
2. **Static vehicles** (§0/§8): the user fetches; rows in `pier_table.py` `car` group -> bake -> LODs; the FRONT LOT + parking alley law.
3. **Poles & fences** (§9): the `line` feature + PLANT tool; chain-link, wire, guardrail; cable catenaries; pole re-draw.
4. **Airport** (§7): hangar catalogue entry x3 shells, built once + instanced; terminal, FBO, tower, fuel farm, beacon, T-hangar row.
5. **Landmarks** (§4): water tower, radio mast, cemetery, boat ramp.
6. **Animals** (§6): dogs, moose, bear, eagle, gulls — user-fetched or Sketchfab CC, prop rows + LODs; the scatter law.
7. **Commercial** (§2): gas station, roadhouse, lodge, office; the `commercial` zone kind + density.
8. **Density dial** on every zone kind (§1).

A second theme (e.g. "Alaska town", "Pacific Northwest") reuses every category and law;
only the preset tables change — which is the reason the categories are fixed now.
