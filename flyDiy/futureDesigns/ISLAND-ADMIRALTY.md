# URSOY — the island, taken whole from Admiralty, renamed, and developed by the player
## Source data, the fantasy pass, and the pipeline that turns one into the other
### (2026-09-01, from the user's design session)

STATUS: plan, unimplemented. Written to be handed to an implementation session.

WHAT IT RELATES TO:
- `futureDesigns/WORLD-V2.md` — the three-tier terrain architecture. This plan
  SUPPLIES its tier 1 and tier 2 from real data instead of from a simulated
  erosion pass, and §8 lists exactly what that changes. Everything else in
  WORLD-V2 stands.
- `futureDesigns/HANGARS.md` §6 — a hangar per airfield. The premise in §9
  below is what makes that mechanic mean something.
- `src/core/20_world.js`, `21_world_hydro.js`, `25_airfield.js`.
- ROADMAP P5 / P6 / P11.

---

## 0. THE DECISION, IN ONE LINE

**Admiralty Island, taken whole from public-domain 5 m radar elevation,
renamed URSOY, given an alpine palette and a low snowline, and developed from
nothing by the player.**

---

## 1. WHY THIS ISLAND, AND WHY THE APPROACH

Three decisions were taken in sequence and each one narrowed the next.

**Real data, not a terrain generator.** What real elevation carries that noise
cannot is ten thousand years of genuine hydraulic erosion — the exact thing
WORLD-V2 §4 identifies as the real ceiling, and the exact thing MSFS gets
superficially right and therefore looks wrong doing.

**Land cover, not imagery.** The look is not inherited. A draped satellite
photograph is flat, carries baked lighting and shadows that fight a dynamic
sun, carries cloud and season artefacts, and locks the palette. A land-cover
CLASSIFICATION instead drives the splat weights and the tree placement, so
**the placement is real and the look is entirely ours.** This is what makes an
Alpine palette over a Southeast Alaskan island possible at all.

**Roadless, not recomposed.** The user's own rule decides it:

> *"On peut couper dans la forêt existante et aplatir un terrain ; c'est
> vachement plus difficile de faire l'inverse. Je veux juste produire et non
> reproduire."*

Subtractive is cheap, additive is expensive. A roadless island lets us CARVE:
clear a strip, grade a shelf, put a jetty in a bay. A developed one forces
either reproduction (an infinite sink for content that serves nothing) or
erasure — and erasing infrastructure from a DEM leaves cut benches, embankments
and terraces that read as wrong.

The same rule kills recomposition, which was the previous plan: two DEMs with
different erosion histories, resolutions and land cover do not join, and the
failure mode is a visible wall. **One island, taken whole. Sea level does the
edges** — which is what WORLD-V2 §2.2 already asked for.

---

## 2. THE ISLAND

| | |
|---|---|
| name | Admiralty Island, Alaska. Tlingit: **Xootsnoowú**, "Fortress of the Bears" |
| dimensions | **145 × 56 km** — fits a 200 km box with room, and it is ELONGATED, which WORLD-V2 §2.2 argued for |
| land area | 4 264 km² |
| highest point | Eagle Peak, ~1 417 m (4 650 ft) — the pipeline reads the authoritative value off the DEM |
| population | 650 (2000 census); **Angoon, 572, is the only settlement** |
| protection | all but 74 km² is the Kootznoowoo Wilderness |
| roads | none of consequence |
| forest | western hemlock, Sitka spruce, western redcedar — dense temperate rainforest |
| water | **Seymour Canal nearly cuts the island in two** — a 50 km fjord up the middle; plus a chain of lakes and portages (the Cross Admiralty Canoe Route) |
| coast | deeply indented, fjords, bays, beaches |

**Seymour Canal is the gift.** A long fjord almost bisecting an elongated
island is a natural flying corridor, a natural mission axis, and a natural
reason for two halves of the map to feel different. It is the spine WORLD-V2
wanted, cut in water instead of rock.

---

## 3. WHAT IT GIVES, AND WHAT IT LACKS — honestly

**Gives:** real erosion at 5 m; mountains; dense forest; fjords, bays and
beaches; lakes; a hundred plausible landing shelves and gravel bars; total
roadlessness; and a size that fits the box without cropping.

**Lacks, and each is answered in §4:**

1. **No glaciers, and little permanent snow.** Peaks at ~1 400 m in this
   climate hold seasonal snow, not ice.
2. **No fields, no farmland.** There is nothing agricultural on the island.
3. **The vibe.** Southeast Alaskan rainforest is wet, dark green and
   grey-skied. The user's stated target is the opposite: *"les Alpes sont
   super, presque féerique."*

That third one is not an accident of this island. **Uninhabited, forested and
glaciated is a narrow set on Earth, because temperate climates that grow
forest get inhabited.** The genuinely wild forested places — Southeast Alaska,
the Chilean fjords, the Kuriles — are all wet and grey *for the same reason
they are empty*. Wilderness and alpine fairy-tale are close to a real-world
contradiction, so the vibe must be MADE, not found. §4.3 is where.

---

## 4. THE FANTASY PASS — three knobs, all cheap

### 4.1 Vertical exaggeration — WITHDRAWN (user, 2026-09-01)

**The first draft of this plan proposed multiplying elevation by k ≈ 1.5-1.8.
It is withdrawn, and the objection that killed it is worth keeping:**

> *"I'm not sure about scale exaggeration since it may compromise the terrain
> type layer."*

Correct. WorldCover's classes are OBSERVED CONSEQUENCES of the real elevation.
Tree cover stops at the real treeline (~600-900 m in this climate). Stretch
elevation by 1.6 and the forest still stops where it stopped — but that station
now sits at ~1 000-1 400 m of stretched elevation, a treeline at an altitude
that corresponds to nothing. There is still no snow-and-ice class at 2 270 m,
which reads as obviously wrong. And every elevation-driven splat rule then
fights the observed classes instead of agreeing with them.

**THE RULE THIS EXPOSES, which is bigger than this decision:**

> **Any transform applied to elevation must be applied to everything derived
> from elevation, or the layers decouple.**

Applies to exaggeration, and — retroactively — to the SEA-LEVEL FLOODING idea
that an earlier draft of WORLD-V2 built its island on. Flooding to 900 m would
have put ocean where the land cover says forest. That idea was dropped for
other reasons; this is the reason it was never going to work.

**What replaces it: lower the snowline, not raise the mountains.** See §4.2.

**If more relief is still wanted after looking at it** (stage C, §11), the safe
form is a MONOTONIC, THRESHOLD-BASED stretch: 1:1 below ~500 m, where
essentially all the land-cover variety lives (forest, muskeg, shore, wetland),
and progressive above it, where the cover is mostly bare and shrub and
distortion costs least. Two properties make that version safe rather than
merely tolerable:

- **any monotonically increasing transform of h preserves D8 flow directions**,
  so the drainage topology — the thing the real data was chosen for — survives
  exactly;
- the bands above the threshold are RE-DERIVED, never transported.

And the general escape hatch, if a transform ever becomes unavoidable: treat
WorldCover as a TRAINING SET rather than a map — learn which class appears at
which (elevation, slope, aspect, distance to water, flow accumulation) on the
real terrain, then re-apply that rule to the transformed terrain. It preserves
plausibility under any transform, but it costs the real spatial pattern, and
Admiralty's muskeg bogs are a genuine feature that no rule will reinvent. A
fallback, not a default.

**Baseline: k = 1.0. No exaggeration.** And it is worth saying that 1 417 m
rising straight out of salt water over ~10 km is not flat — Southeast Alaskan
peaks come out of the sea.

### 4.2 A lower snowline (this is now the answer to the snow gap)

The user wants snow and perhaps a glacier. **That does not need taller
mountains — it needs a colder climate**, which is a fiction and palette
decision rather than a geometry one, and it therefore breaks nothing.

Put the permanent snowline at ~900 m and a 1 417 m peak carries snowfields
over its top 500 m on north aspects — which is exactly what an Alpine summit
of that height looks like. Synthesise from elevation × aspect × slope as a
SPLAT layer, never as geometry, so it costs nothing and stays tunable beside
the palette (§4.3). One or two cirque glaciers can be authored as terrain
modifiers (WORLD-V2 §9) if the look wants them.

The land cover stays honest throughout, because nothing moved.

### 4.3 The palette and the light — where the Alps come from

This is a MATERIAL AND ATMOSPHERE decision, isolated in one layer, tunable
without touching a byte of source data. The diagnosis of why the Alps feel good
and Kodiak does not:

| | Southeast Alaska | the target |
|---|---|---|
| light | low sun, overcast, flat | high sun, clear, directional |
| greens | dark, blue-shifted, wet | saturated conifer + bright alpine meadow |
| rock | grey, wet | warm, dry |
| sky | white overcast | deep blue with aerial perspective |
| valleys | open, exposed | intimate — you fly IN them |
| human trace | none | scattered, small, lived-in |

The geometry says wild fjordland; the sun angle, the material colours, the
atmosphere and the scattered human trace say Alps in summer. **Because nothing
was inherited from a photograph, this costs nothing but tuning.**

The last row is the important one and the most surprising: **most of the
"féerique" is that people live there** — chalets, pastures, small fields, a
track up a valley. That is a PROCEDURAL layer, not a modelled-landmark layer,
which is exactly §9's premise. We get the vibe without ever modelling a
monument.

---

## 5. THE DATA

| layer | source | resolution | licence | note |
|---|---|---|---|---|
| **elevation** | **USGS 3DEP Alaska IFSAR DTM** | **5 m** | **public domain** | statewide; **use the DTM (bare earth), never the DSM** — in a rainforest the DSM is the canopy top, ~40 m above the ground |
| land cover | ESA WorldCover | 10 m | CC-BY 4.0 | 11 classes; drives splat weights and tree placement |
| land cover (cross-check) | NLCD Alaska | 30 m | public domain | locally tuned; worth comparing against WorldCover |
| coastline | derived from the DEM at h = 0 | — | — | no separate source needed |
| bathymetry | synthesised shelf | — | — | nobody dives; a plausible falloff is enough |
| imagery | **none** | — | — | see §1. Sentinel-2 is CC BY-SA 3.0 IGO — the ShareAlike is a further reason to stay away. Not legal advice; verify if this is ever revisited. |

**The licence position is unusually clean:** the elevation is US federal public
domain with no obligations at all, and the only attribution owed is
WorldCover's CC-BY, which `CREDITS.md` already has a home for.

**5 m public-domain elevation over the whole island is the technical reason to
choose Alaska**, and it changes WORLD-V2's architecture for the better — see §8.

---

## 6. THE PIPELINE (offline node/python tool, not the browser)

    1. FETCH        the 3DEP IFSAR DTM tiles covering the island bbox
    2. MOSAIC       into one raster; note the projection (Alaska Albers or
                    UTM 8N) and the vertical datum, and pick ONE game frame
    3. CLIP         to a working domain of ~180 × 100 km, island centred,
                    leaving open sea on every side
    4. CLEAN        the single settlement: Angoon's harbour works, any cut
                    benches. A DTM has no buildings, but it has scars.
    5. EXAGGERATE   h *= k                                          (§4.1)
    6. RESAMPLE     tier 1 base + cut tier 2 tiles                  (§7)
    7. LAND COVER   reproject WorldCover onto the same grid; derive splat
                    weights and tree-placement density
    8. HYDROLOGY    run the EXISTING `bakeHydrology` on the result — it will
                    find the island's real rivers and lakes, which is a free
                    validation of both the data and the bake
    9. GUIDES       export slope, flow accumulation, curvature and aspect —
                    the fields WORLD-V2 §4.3's detail synthesis is steered by
    10. RENAME      strip every real toponym. GATE: no source name survives.

Steps 1-4 run once and are a human sitting with the data. Steps 5-10 are the
repeatable tool, and it must be re-runnable end to end, because k and the
palette will be tuned dozens of times.

---

## 7. BUDGETS — recomputed for THIS island

Domain ~180 × 100 km; land 4 264 km²; source natively 5 m.

| tier | resolution | extent | raw | resident |
|---|---|---|---|---|
| **1 · base** | 25 m | whole domain | 7 200 × 4 000 = 29 M × 2 B = 58 MB; **~15-25 MB compressed** (about half the domain is constant sea, which compresses to nothing) | always |
| **2 · detail** | **5 m native** | **the whole island** | ~325 M samples ≈ 650 MB as ~1 240 tiles of 512² | 10-20 MB streamed |
| **3 · modifiers** | vector | decisions | KB | always |

**The finding that matters: tier 2 stops being "hero tiles at designated
sites".** WORLD-V2 rationed high resolution because an erosion simulation
could not produce it everywhere. Here the 5 m data already exists across the
entire island, free, so tier 2 becomes **5 m everywhere, streamed** — which
directly serves the rule WORLD-V2 §3 insisted on: *a bush aeroplane may land
anywhere, so detail cannot stop outside the designated sites.*

650 MB of static, cacheable, streamed tiles is unremarkable — the project
already ships 409 MB of assets — and only 10-20 MB is ever resident.

Below 5 m, WORLD-V2 §4.3's guided synthesis takes over, and its guides now
come from **real** drainage rather than simulated.

---

## 8. WHAT THIS CHANGES IN WORLD-V2

| WORLD-V2 | becomes |
|---|---|
| §2.2 island shape — authored or seeded, flooded to make a coast | **sourced**: one roadless island, taken whole, its own coastline. Flooding is no longer needed. |
| §4 erosion simulation, offline, 4096² | **deleted.** Replaced by §6's data pipeline. This was the largest and least certain chantier in the document. |
| §4.3 guided detail | **unchanged and improved** — the guides are measured, not simulated |
| §6.1 splat material | **gains its real input**: WorldCover 10 m |
| §3 tier 2 "hero tiles at sites" | **5 m everywhere, streamed** (§7) |
| §12 Q2 "seeded or authored island?" | **answered: sourced, then transformed** |
| §12 Q4 "how much of `h0` survives?" | `h0` becomes the fallback only. The analytic terracing and ridged terms have nothing left to do and should probably go. |
| W4 chantier | a data pipeline instead of a simulator — cheaper, and a better result |
| W5 chantier | still the step that invalidates every golden, still isolated |

**One contract change to take deliberately.** `makeWorld(seed)` becomes
`makeWorld(island)`: the world is no longer seed-driven and its determinism
comes from an ASSET rather than from an integer hash. GATE WORLD is built on
the other assumption and must be reworked, not patched.

---

## 9. THE PREMISE — and why it ties three specs together

The user's own framing:

> *"On peut juste simuler un développement sur une île vierge."*

That is not a wrapper, it is the game's spine, and it makes three separate
mechanics necessary instead of merely available:

- **there are no airfields at the start** — which is why the airfield editor
  exists, and why site nomination (WORLD-V2 §7) matters: the island scores its
  own landable shelves, gravel bars and beaches, and the player promotes them;
- **there are no hangars at the start** — which is what `HANGARS.md` §6's
  hangar-per-airfield is FOR, and what makes a field shed at your first strip
  a real event;
- **there is no economy at the start** — P5's missions and wallet become the
  reason to open the second strip rather than a scoring layer bolted on.

One village of 572 people at the edge of a wilderness is the perfect opening
position: somewhere to fly FROM on day one, and nothing else on the whole
island.

**And the name is a gift.** Xootsnoowú — "Fortress of the Bears". Do not use
it; it is a real Tlingit name for a real place. But it is the register the
invented name should be in.

---

## 10. GATES

**GATE ISLAND** (new).
1. No source toponym appears anywhere in the shipped data or code.
2. The pipeline is reproducible: same inputs and same k give byte-identical
   output.
3. The coastline derived at h = 0 is closed, and every land cell is reachable
   from every other by air within the domain.
4. Tier 1 and tier 2 agree within tier 1's quantisation wherever both exist.
5. Angoon's real footprint is absent.

**GATE WORLD** (exists) is reworked for an asset-driven world, not patched.

**GATE SITES** (WORLD-V2) — every nominated landing site is flyable into,
measured with `41_test_pilot.js`.

---

## 11. STAGING

This slots into WORLD-V2's ladder and changes only W4/W5.

**A — the material pass.** WORLD-V2's W1, unchanged and still first: splat
materials on today's mesh and today's world. Depends on nothing, and it is the
largest visible improvement available.

**B — the clipmap.** WORLD-V2's W2.

**C — the pipeline, on a slice.** Run §6 on ONE 20 × 20 km piece of the island
and load it as the existing 24 km domain. Everything is provable against a
world that already works, and k and the palette get their first tuning here.

**D — trees.** WORLD-V2's W3, now driven by WorldCover.

**E — the whole island.** The step that invalidates every golden, and the step
that does nothing else.

**F — streaming + nomination.** Tier 2 across the island, the landability pass,
promotion.

**G — the airfield editor.** Its own document, on WORLD-V2 §9's format.

---

## 12. OPEN QUESTIONS

1. ~~**Does the island keep its real name?**~~ **DECIDED 2026-09-01: renamed
   URSOY.** From *ursus* plus the Nordic *-øy*, spelled without the diacritic so
   it survives a filename, a URL and a code identifier unharmed. It names the
   island's one genuinely transferable characteristic rather than borrowing the
   Tlingit meaning: Admiralty carries one of the highest brown-bear densities in
   North America — more bears than people — and a bear on the beach you just
   landed on is bush flying, not trivia. It also gives the map a naming grammar
   (Ursoy · Urs Sound · the Ursoy strip). Alternatives considered and available
   if taste changes, since this is one constant: **Sylvane** (from *silva* —
   softer, more alpine-fairy-tale) and **Vardan** (from *varde*, a cairn —
   colder, more severe).
2. **How much vertical exaggeration?** 1.5-1.8 is proposed. It is the single
   most character-defining number in this document and it should be chosen by
   looking, at stage C, not by argument.
3. **Does Angoon survive as a settlement?** Reimagined and renamed, it is the
   perfect starting position (§9). Removed, the island is pristine and the
   player builds the first everything. Both are good games; they are different
   games.
4. **Seymour Canal: one map or two halves?** A 50 km fjord almost bisecting the
   island invites treating the two halves as distinct regions with distinct
   weather and distinct missions. Free content, if wanted.
5. **NLCD Alaska or ESA WorldCover?** WorldCover is finer (10 m vs 30 m);
   NLCD is tuned for Alaska. Compare on the stage-C slice rather than deciding
   on paper.
