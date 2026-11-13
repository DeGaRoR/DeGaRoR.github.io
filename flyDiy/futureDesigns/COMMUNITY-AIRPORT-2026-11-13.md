# COMMUNITY-AIRPORT - the community field at w7 in three stages (cloud session, 13 Nov 2026)

The user (13 Nov): the community airport at **w7 New Community Runway** (1 020 m dirt, 9 m) - today's strip is the MIDDLE
stage; before it a shorter, bumpier, narrower strip on sticky mud, on the same axis and joined to both ends by a plain path;
after the last pass a wider, smoother gravel strip with minimal infrastructure. Scenery that fits an isolated community that
wants to be as autonomous as possible: little money, but time and hands.

## Where it is

Not the north-east. w7 lies at the island's **far north, on its west side**: centre (-3 554, -23 721), heading 168 deg
(east-south-east end 0 at (-3 055, -23 827), west-north-west end 1 at (-4 052, -23 615)), 42.6 m up on flat ground (the
centreline is level to the centimetre; +-2 m 25 m either side). The community it belongs to is the residential zone **z1**
~500 m south-west of its west end, on the shore with a seaplane float (s29); road **r37** runs from w7's west end to that
village, **r38** from its east end away east - both begin exactly on the axis at the strip's ends. **w6 Old Community
Runway** (311 m gravel, 132 m up) is 1.7 km south-south-west on higher ground, not beside it. The island's frame: north =
-z, x east (jolene_author.py). The community is fictional: generic people props, generic buildings, nothing named after a
real place or people.

## The track - a SITE's stage, moved by a project

`community` is a stage track of a new kind: **a site's track** (76_stages.js `STAGE_SITE_TRACKS`), max 2.
- Its value is `career.sites.community` - the state a mission-pack PROJECT's step sets (claude/mission-packs 73b
  `careerProjectsTick`: a step's `site: { id: 'community', state: 1 }` writes `career.sites.community = 1`); clamped 0..2;
  absent (the project not begun) 0.
- `stageMaxes()` carries it, so the sandbox (every track at its max) is the LAST stage, as for every track.
- `STAGE_REVEALS['community:1' | 'community:2']`: at w7, world true; captions `trk.community.1/2` are plain placeholders in
  CONTRACT_TEXT ("The community strip graded to its full length", "...gravelled and widened") - **the Game coordinator's to
  word**.
- CONTRACT_TRACKS is untouched (GATE CONTRACTS' five tracks stand).

For the project (the Game coordinator's): steps `{ ..., site: { id: 'community', state: 1 } }` then `state: 2`. The page
recomposes at the next roll-out when it is told (app.js `stageNote(doc)` -> the 'stages' trip step) - **the page must call
`stageNote` after `careerProjectsTick`** (today it is called on the stop's unlock events only).

## The stages (data: tools/jolene_stages.json `runways:w7` + `sg_ca_` entries, written by tools/community_author.py)

| stage | what | length | width | surface (code) | look | bumps (micro chaos) | 2 m bump read off terrainH |
|---|---|---:|---:|---|---|---:|---:|
| 0 | the first strip (before the project) | 600 m | 8 m | MUD_FIRM (11) - sticky mud (SNOW-MUD) | `mud` | 0.45 (no stones: rocks 0) | 13.3 mm |
| 1 | one pass = today's strip | 1 020 m | 9 m | GRAVEL (6) - dirt has gravel's friction | `dirt` | 0.25 (w3's class) | 6.3 mm |
| 2 | the last pass = the sandbox | 1 020 m | 15 m | GRAVEL (6) | `gravel` | none - graded smooth | 0.9 mm (the raster's lattice) |

- One axis: the centre and heading never move. Stage 0 is the middle 600 m; **a plain track** (3.6 m, dirt look, ungraded)
  runs on the axis from each end of the mud strip to the full length's ends (210 m each side), where r37 and r38 begin -
  so the axis and the ways to it exist from the start. At 1 and 2 the strip covers the axis.
- 8 m is the narrowest a strip may be (27_premises stageIssues); 9 -> 8 is therefore the narrowing.
- The physics follows as Skyline's runway does: the vary rows are composed into the record before compose
  (27_premises stageView), so the wheels' surface (W.surface), the ground (terrainH, with the micro modifier), the
  aerodrome row the pilot reads (len, wid, surface, look, micro) are the stage's. A stage changes at a composition (load,
  roll-out, roll-in), never in flight (76_stages stageHost).
- **New in the premises contract**: `micro` joins STAGE_RUNWAY_VARY (a stage may change a strip's bumps).
- **Grading**: the strip's grade/profile is unchanged (`profile` null: the composed level strip); the falloff 60 m. The
  user's "grading" is carried by the bumps (chaos) and the width.

## The scenery per stage (every entry an existing asset; the yard at the strip's middle, south side, >= 25 m off the
## centreline; trees only by the tree system - an exclude clears the yard)

Stage 0 - the first strip (stands from the first day, kept after):
- the strip's hut: `shed/trapper cabin` (stove pipe), a `shed/lean-to` of split logs
- the fire barrel (`stove_barrel`) and three stools round it; a jerrycan
- the garden plot: 12 x 8 m behind the old fence (`fence_old`, the gate on the strip side), two planters, compost and
  sacks, a person weeding (`person_koky`)
- a salvaged car body (`car_junk`)

Stage 0 only - the work on the mud:
- the farm tractor with a home-made drag of three old tyres, two people at it; a third with the hand truck; pallets, a crate
- oil-drum markers 5 m off the mud strip's edges every ~100 m (14)

Stage 1 - one pass (kept after):
- the woodshed with its cordwood (`shed/wood shed`), a tool shed, the smokehouse (`house/fish shack`, its chimney smoking)
- the fuel point: four drums, a plastic tank, a jerrycan; a picnic table; an old red pickup

Stage 1 only:
- the rusty loader the community salvaged (`machine_loader_rusty`), the tractor and its tyre drag back from grading the
  new length, two people at them
- drum markers 5 m off the 9 m strip's edges, full length (22)

Stage 2 - the last pass (the sandbox):
- a small field hangar (`hangar/field shed, small`: raw planks, a worn corrugated roof - one aeroplane under a roof)
- the outhouse; a gravel apron beside the strip (material + its wheels' surface, 32 x 20 m)
- what is left of the gravel heaps: two `raise` mounds (1.3 m, 0.9 m) under a gravel look, by the hangar
- the skid-steer and the tractor parked; two people at rest round the picnic table
- drum markers 5 m off the 15 m strip's edges, full length (22)

Solid things standing: 46 / 62 / 61 (stage 0 / 1 / 2) - instanced registry props and the catalogue's buildings with their
own LODs; static; nothing per frame. The reveals (stageReveal, the centre of what changes) land beside the yard:
community:1 -> eye (-3 498, -23 661), community:2 -> (-3 505, -23 663) (tools/stages_shot.js lists the before / after /
sandbox stills for A0's GPU box - the cloud cannot render the world).

### Garage gaps (no asset today - REF_MATCH-style flags, not built)
- **A small wind turbine** and **solar panels on a roof**: nothing in the prop tables or the generators' presets. Two
  candidates for the next asset budget (the house generator could grow a `solar` roof row; a turbine is a pole + a rotor).
- **A hand-painted sign**: the billboard kind draws runway designators only; a free-text painted board is a gap.
- **A windsock on a spruce pole**: the strip's own windsock (`sock`, default on) stands at every stage - its pole is the
  generic one.

## The pilot at every stage (checked, 43_pilot.js not edited)

tools/community_fly.js / GATE COMMUNITYFLY fly the game's way (gameHost: the game's day, placement and pilot, damage on)
w6 > w7 > w6 at each stage with the user's Cub and the metal Cessna. See the HANDOVER entry for the table.

What the pilot reads, per stage: the aerodrome row (len, wid, surface, micro) - `a.micro` drives its rough-strip rules
(STRIP-LANE: the slow taxi x (1 - chaos), the turn where the run + 30 m is ahead on a long rough strip); the surface's
GROUND_SURF row its technique. **Finding for the Pilot coordinator**: firm mud's base row rolls 0.050 (< the pilot's 0.10
"soft" threshold, 43_pilot.js ~1414 / ~3963), so the pilot departs the mud strip with the NORMAL technique; the sinkage
drag (GROUND_SOFT) is not part of that choice. The Cub and the Cessna still use the 600 m mud strip (numbers in HANDOVER).

## Open for others
- Game coordinator: the project's steps (site `community`, states 1, 2); `stageNote` after the projects' tick; the two
  captions; **79_story.js 'client' names w7 "long and easy" (T3)** and **72_contract_data CONTRACT_FIELDS.w7 is 1 020 m
  dirt** - both static, true only from stage 1; a career whose project has not begun stands the 600 m mud strip.
- Pilot coordinator: the mud technique (above).
- A0: the stills (stages_shot.js community_1/2); the four cooks are in this branch (premises, fleet spots, map; the city
  cook unchanged - w7 is no town cell).
