# The world out of a hangar's door: the garage-view toolset

The user, 22 Nov 2026: "the world outside keeps being really, really ugly ... recreate as accurately as possible the real
world ... measure in the world what are the distances ... as close as possible to the game, but without costing much on
the garage." And: "generalise this so we can update / re-use on other hangars automatically or semi automatically."

What a garage room shows through its door is a COOKED SCENE: the game's own world round that airfield, measured and
captured once, as a few static meshes. The sky, the clouds, the sun and the hour stay live (hangar.js applyDay). One scene
serves every hangar of an airfield. This file is the how-to; each tool prints its own usage at the top of its file.

## 1. The stages (one site = one airfield)

| Stage | Command | Needs | Gives |
|---|---|---|---|
| site | `node tools/garage_view/site.js list` / `new <field>` | nothing | `tools/garage_view/sites/<pack>.json` |
| survey | `bash tools/garage_view/gv.sh <pack> survey <out>` | CPU, ~4 min | `measure.json`, `census.json`, the maps, the schematic door views, the user's page |
| capture | `bash tools/garage_view/gv.sh <pack> capture <out>` | **a GPU slot** (A0), 25 min | the game's door views (the references), the ground tiles, the buildings and vehicles, the far band, the tree sheets |
| build | `bash tools/garage_view/gv.sh <pack> build <out>` | CPU, ~2 min | the ground textures, `scene.json` + `scene.bin` + pictures, installed in `media/garage_view/<pack>/` and `src/core/garage_view_packs.json` |
| shoot | `bash tools/garage_view/gv.sh <pack> shoot <out>` | **a GPU slot**, 20 min | the garage from the same eyes: `today_*` (the room's own outdoors) and `gview_*` (the cooked scene) |
| check | `node tools/run_gates.js --only=GARAGEVIEW` | CPU, seconds | STALE or fresh, whole, under the budget |

Every node / Chrome run goes through `cpu_token.sh` (the box's rule); a GPU stage is a slot script that takes the token
first and the gpu lock inside (`gv.sh` writes it; RIG-PROCEDURE.md).

## 2. What each tool does

- `site.js` - the site file: world, record, field, sheds (plot id + the shell the views are measured for), the radii.
- `measure.js` - the island world built in node from the record: each shed's place, TRUE yaw, door and room frame; the
  terrain; every runway, apron, road, building, vehicle, parked aircraft, prop; the skyline per degree from each door.
- `census.js` - the drawn forest, tree by tree (`TREE_FILL.census` in render_world.js: the fill's own walk through the
  build's own size rule, the world editor's sink included), from the page booted in node. No GPU.
- `map.js`, `sketch.js`, `page.py` - the user's survey page: maps with distances, skylines, schematic door views
  (`ref` the measured world, `today` the room's hand-drawn outdoors, `built` the cooked scene's own triangles).
- `capture.js` - the GPU run (page_rig.js). `refs` the game from each door at each hour; `card` a calibration card (known
  sRGB texture values on a Standard material) under the same light; `ground` the ground from above in tiles, everything
  that stands hidden (near 12 m up: ~1 cm a pixel in front of each door; mid 120 m: the whole pavement; wide 1200 m);
  `props` each building / vehicle as its own triangles + pictures from the doors' directions; `far` the world past 700 m
  as a band; `trees` the species' impostor sheets; `garage` the garage itself from the same eyes (`--tag today|gview`).
- `ground_merge.js` - the tiles rectified against the measured terrain (each texel a world point through each tile's own
  camera), blended, and turned back into TEXTURE values by the card.
- `cook.js` - the scene: terrain meshes wearing the mosaics, the far ring, every tree within the site's radius as a card
  of its species' sheet (8 level views, the game's tint, normals in the card's frame), the props textured by projection.
- `install.js` - into `media/garage_view/<pack>/` and the pack list.
- `src/viewer/garage_view.js` - the runtime: `load` (behind the first garage view), `build` (the scene in the shed's room
  frame by its true yaw; one haze uniform). `hangar.gviewFrom(pack)` stands it and takes the hand-drawn outdoors down.

## 2b. The door view is judged against the game, in numbers

The user, 22 Nov: "you are taking the in-game shots and then you compare ... we would like to minimise these differences,
as simply as that." A shoot is read with the game's reference from the same eye beside it, and measured: the linear
medians of five bands of the door view (sky top, sky low, tree line, apron far, apron near), the garage over the game
(`gv_measure.py`: 1.00 is the game). What the first rounds taught, each one a fault the eye saw and the numbers named:

- THE LIGHT LEVEL. The room draws its sky at the room's unit with the lamps' exposure: a quarter of the game's by day,
  nothing at night. While a cooked scene stands, what is OUTDOORS (the scene, the sky dome, the clouds) takes the
  world's own lights and the world's exposure: `WORLD_RIG.lightFor(day, cT)` (render_world.js: sky_light's call as the
  world makes it, on stand-in lights) asked by `hangar.applyDay` before its own; `garage_view.js S.expose` (1 = the
  game's). The room keeps its lamps' exposure, and its probe is shot at the room's level (`gviewBake`). First run:
  the sky 0.77-0.92 of the game's at noon, the apron 0.82-1.08 (before: 0.25).
- THE CLOUDS. The room's own cloud sphere marches once a pixel with no history (grainy, "harsh"). Through the door they
  are the GAME's pass (`CLOUDS.draw` from the room's eye stood in the world, `hangar.gviewCloudCam`; the composite on a
  quad of the room's): the flight's own programs. The air between (aerial perspective) is switched on for that pass
  only. `S.cloudPass` 0 gives the room's sphere back.
- THE MOUNTAIN LINE. The room's sky sphere stood 600 m out and wrote depth: the far band's wall (700 m) and every tree
  past 600 m were hidden. While a scene stands the sky is drawn first and writes no depth.
- THE TREES. A card cut at half its sheet's coverage is skinny. The game's own curve: `(a - 0.40) x 6 + 0.5`, softer
  far, alpha to coverage (`S.treeCut / treeAlpha / treeSoft`); the game's leaf wrap in the light.
- THE LAMPS. The scene's materials are unlit for three, so the room's lamps no longer reached the apron: the night went
  black. They are back as one term (`gvLamps`: the room's five fittings, three's own spot law, through the door's
  opening, at the room's level). The user: "you're gonna have to have them on at night."
- THE SHED'S SHADOW takes the sun away and leaves the sky (a multiply by what is left, channel by channel): blue, as
  the game's, not a neutral dark.
- A CLOUD OVER THE DOOR darkens the sun near the door only; far from it the sun is the sky's mean (`S.cloudFar`).

- THE WHOLE PICTURE, NOT ONE BAND. A cloud drifts over the door between two shoots and dims the sun near it: one band at
  noon is noise. Read the whole picture by thirds (sky, horizon, ground), several views, and trust golden hour and
  night for the ambient terms. The last rounds: the world's environment ambient by day (`S.env`, fading with the sun),
  a stronger haze, the cards' gain; a lawn site's `ground.gain` (a lawn shot from above is darker than along the
  ground). Club hangar, whole picture: noon 94-101 % of the game's, golden hour 98-100 %, night 99-129 % (the lamps).
- A CUT-OUT'S EDGE (the user: "a very jagged line ... with little black pixels ... typical transparency border
  management"). A silhouette texel is a mix of the thing and of the black the picture was cleared to. `cook.js
  cleanEdge`: the two texels inside the cut take the colour further in, the outside takes it too, the alpha across the
  cut is a slope; the far band is encoded in UASTC (ETC1S blocks an alpha edge in 4 x 4 stairs); the rings' rows lie
  16 texels apart in their sheet.

Keep it simple (the user: "let's not get too many subsystems into the garage"): every item above is one uniform or one
call into the game's own code, behind the scene's switch; without a scene the garage is untouched.

**The switch.** The door view is ON wherever a room has a cooked scene (`?gview=0` keeps the room's hand-drawn
outdoors; `window.FLYDIY_GVIEW_ON = true / false` is the rigs' switch). It is asked for behind the first garage view,
built held down, its programs linked off the frame (`compileSliced`), then shown: `GARAGE_VIEW.prelink()` returns that
job, `GARAGE_VIEW.ready` says it stands.

**What it costs** (`capture.js --do garage --perf`: today / the scene / a variant, in one boot; 22 Nov, canvas 640 x
900, uncapped): the frame's interval 4.6 -> 4.1 ms in the club hangar, 4.6 -> 5.0 in the large one, 6.2 -> 5.9 in the
Shed; fewer draw calls (99 -> 64), about 50 000 more triangles; the game's cloud pass in the room 0.3-0.65 ms of GPU a
frame at that size (it grows with the pixels); a scene is 10-13 MB to download, about 58 MB of GPU memory, stands in
9-12 ms.

## 3. Frames and traps

- World metres: x east, z south (north = -z), y up. A shed stands at (x, y, z) turned by `ry = pi - hdg`, its door at
  room-local -x. world -> room: `lx = dx cos ry - dz sin ry`, `lz = dx sin ry + dz cos ry`.
- `25_airfield.js siteToLocal` is the analytic field's fixed quarter turn. On an island it is WRONG for a shed (Jolene:
  41 degrees). Never place the outdoors with it.
- The game draws impostors past 30 m; a tree nearer than that to a door needs the real model (none on Jolene's club
  field: the nearest is 62 m). `measure.js` + `census.js` print the nearest trees: check before cooking a new site.
- Never hide or lift the player's aeroplane in a capture: slot 1 (22 Nov) hung after it was parked 400 m up and hidden.
  It is placed on the ground behind the last shed instead.
- People are never in the ground pictures (the user's rule); parked aircraft are left out; vehicles are real models.
- A capture's pictures are tone-mapped display values: only the CARD turns them back into texture values. No card, no
  texture.
- The sandbox world has no building on a plot the player does not hold (HOME.2): the references show the world as it is.
- `visible = false` does not hold in the game: the fill's partition, the LODs and the thrift re-show their meshes every
  frame, and a hidden caster still shadows. `capture.js` enforces its hide list inside the draw (the `FLYDIY_AA.render`
  wrap) and sets the lights' `shadow.intensity` to 0 for the ground pictures. Look at the tiles before the cook: a tree or
  the shed's shadow in one means the hide list missed a name (read `scene_graph.json`).
- A slot may end before the last thing is photographed: `cook.js --props <new capture>,<older capture>` takes each thing
  from the first capture that holds it.
- The cooked scene is NOT lit by the room. Its materials are unlit and carry the world's own sun, sky and ground light
  and one haze (`garage_view.js lit()`, fed by `hangar.applyDay`): the room's lamps and its probe would tint the apron.
- The room does not stand its own shed's outside round itself: the cook writes each world shed as a mesh of its own
  (`props:shed:<id>`, with its place), the page skips the one within 12 m of the room.
- The low layers (shrubs, ferns, flowers, rocks) are shot from ONE eye (the first shed's door) in rings of distance:
  right from that door, a little off from a shed 70 m away. Two sheds far apart want two sets of rings (not built).

- THE CALIBRATION CARD MUST LIE ON OPEN, LEVEL GROUND. Every colour of the scene is read through it. At the Cabin
  Strip the default place (60 m out of the door, at the shed's floor height) was a forested slope: the card stood buried
  under a tree and the curves were noise (a white grass strip, a blue cabin, blue summits). `sites/<pack>.json card.out`
  says how far out of the first door it lies; `capture.js` lays it at the ground's own height (0.6 m over a grass
  strip, above the blades). LOOK at `card_ground12.png` before the cook; `ground_merge.js` prints the greys it read
  and the worst patch error.
- A GRASS STRIP IS ITS BLADES. The ground pass hides the cover ring with the other low plants; a site whose ground is a
  lawn sets `ground: { cover: true }` or the strip bakes bare and pale. A lawn shot from straight above still comes out
  darker than the same lawn seen along the ground (measured at the Cabin Strip: about half).
- WATER, SEEN FROM ABOVE, IS NEAR BLACK. A lake 160 m behind Jolene's hangars read as "a gap in terrain" through the
  back window. Two wrong guesses came first (the land's end; the forest's floor): SAMPLE the baked texture and the
  measured surface AT THE SPOT before guessing. `cook.js groundTex` gives measured water (surface 4) a sky-throwing
  colour, lifts the near-black floor under the hidden canopy, and fills what no tile covered.
- NOTHING ALIVE IN THE SCENE. An elk walked by the Cabin Strip's tower and was baked into the low rings: the rings'
  pass hides the animals, the crowd and the residents, as the things' pass does.
- A ROOM AT ANOTHER PLOT (the garage step: each shed's room at its own plot) is written into the player's document as
  `playerAcquire` writes it, WITHOUT the price book (the career's `econShellPrice` is not in the sandbox page).
- NEVER EDIT A SLOT SCRIPT WHILE IT RUNS (bash reads it as it goes), and a waiter started before a queue script changed
  keeps the old one: kill it by its own PID tree and start it again.

## 4. When the world changes

GATE GARAGEVIEW compares every pack with today's record: a shed moved or turned, or the record's `rev` changed, and the
gate fails with the pack's name. Re-run survey (CPU), then capture + build (one GPU slot). A site whose record did not
change near its sheds may be re-signed after a look at the survey's map against the old one; never by weakening the gate.

## 5. A new site

`site.js new <field>` writes the file from the record (every plot of the field, the widest shell it offers). Check the
map (`survey`), set `mid` / `near` / `trees` if the paving is larger than the defaults, then capture, build, shoot, and
put the side by side on a page for the user: a look lands whole, judged in the game.

## 6. Log

- **jolene_home** (Jolene AFB 13/31: the club hangar HOME, the large hangar HOME.2), 22 Nov 2026: the first site. Both
  doors bear 41 deg (north-east), 197 m from runway 13/31; 86 148 trees drawn within 1.5 km, 12 463 within 700 m, the
  nearest 62 m from the club door, median height 6 m; the skyline's highest summit 875 m at 7 km.
- **jolene_cabin** (the Cabin Strip, field w1: the Shed), 22 Nov 2026: a steep valley (the ground runs 161 to 409 m
  within 420 m), 254 trees within 100 m. Its site file carries what a slope needs: `far { low -9, top 36 }`,
  `card { out 18 }`, `ground { cover true, gain [1.5, 1.5, 1.6] }`, its own `slices`.

## 7. Handover, 23 Nov 2026 (the session stood down; what a next one takes up)

**Where it stands.** Ready `claude/ready/garage-view-1` (7222af929) rides train L40M; the door view is ON by default
(`?gview=0` turns it off). The branch `claude/garage-view` is that ready plus tool-only commits (capture.js boots a
visible window by default; `--headless` is the old way). Evidence (captures, cooked scenes, shoots) is under
`D:/Dev/flydiy-notes/evidence/GARAGE-VIEW/` (home: `measure`, `capture2`, `capture3`, `scene8`, shoots `garage12`,
`garage13`, `garage13_5k`; cabin: `cabin/measure`, `cabin/capture2`, `cabin/scene6`, shoots `cabin/garage6`,
`cabin/garage7`). The user's pages are built by `compare.py` from those folders.

**One round, as it was run** (EV = the evidence folder; every node / Chrome run through `cpu_token.sh run GARAGE-VIEW`,
the capture and the shoot inside one `--gpu` slot whose script takes and drops `boxlock.sh take/drop gpu GARAGE-VIEW`):

    node tools/garage_view/measure.js --site <pack> --out EV/measure                     # CPU; the world round the sheds
    node tools/garage_view/capture.js --measure EV/measure --out EV/captureN --do refs,card,ground,props,slices,far,trees \
         --times now,noon,golden,night --cap <s> --page dev.html                          # GPU; the game itself
    node tools/garage_view/ground_merge.js --cap EV/captureN --measure EV/measure --out EV/captureN
    node tools/garage_view/cook.js --measure EV/measure --cap EV/captureN --ground EV/captureN --layers EV/captureN \
         --props EV/captureN --out EV/sceneN                                              # CPU, about 6 GB
    node tools/garage_view/ktx2.js --scene EV/sceneN ; python tools/garage_view/textures.py --scene EV/sceneN --max 4096
    node tools/garage_view/install.js --scene EV/sceneN ; node tools/build.js             # never build while a slot boots
    node tools/garage_view/capture.js --measure EV/measure --out EV/garageN --do garage --tag today,gview \
         --times noon,golden,night [--rooms HOME] --perf --cap <s> --page dev.html        # GPU; the garage, same eyes
                                                                                          # (every shed of the site unless --rooms)
    python tools/garage_view/gv_measure.py EV/garageN EV/captureN sheet.jpg club HOME     # garage / game, 1.00 = the game
    python tools/garage_view/compare.py --refs EV/captureN --garage EV/garageN --today EV/garageM --sheds '<id:shell:title:views>'
    node tools/run_gates.js --no-build --jobs=1 --only=GARAGEVIEW,HANGARVIEW,HANGAR,ROOMMERGE,UISMOKE,WORLDRENDER,STORY,INTROSCENE,LIGHT,PROGRAMS,CLOUD,ASSETBUDGET

A change of look only (the settings `S` in `src/viewer/garage_view.js`) needs the build and the shoot, not a capture.
Master's own reds at the time (not this work's): FRAMECOST, MEDIA (thumbs), ASSETS (dupes), STORAGE.

**Open, none of it started** (each needs a GPU shoot and a look by the user, so none was squeezed in before the train):

1. *Small props by the doors* (the picnic table, the planter: the world's `propInstances`). They are in no export:
   `capture.js --do props` takes the things of the record, not the instances. Add them to the props step (real
   triangles + the door-direction photo, as the cars), then cook with `--props`.
2. *The step of brightness at the sill.* The room is lit at unit 1 under the lamps' exposure cap, the outdoors at the
   game's exposure (`uGvEx`); the sun's patch on the room's floor keeps the room's level, so the floor inside the door
   is darker than the apron outside it. A cheap try: fade `uGvEx` over the first metres past the sill (by `vGvP.x`),
   or lift the room's floor patch; judge at noon and golden hour from `door_out`.
3. *The Cabin Strip's far summits read dark and blue* (the top rows of the far band), its golden hour and night sit at
   97 to 140 % of the game, the tower's glass is black, the Shed's shadow is heavy (`S.shadow` 0.92). The far band is
   game pixels past 700 m through the calibration LUT: check the LUT at the dark end and the scene's haze (`S.hazeK`)
   against the references before touching the capture.
4. *Not tested with the scene standing:* the HANGAR-VIEW mode and the photo mode; the night-eye grade is not applied
   outdoors.
5. *Cost on a 5K window in a visible browser* is the performance lab's to confirm. Headless that night: 3.4 ms today,
   4.0 ms with the scene and the game's cloud pass, 3.3 ms with the scene and the old cloud sphere; single frames of
   29 to 61 ms in all three states, today's garage included, each with a burst of about 800 draw calls (the probe's
   bake is the suspect, unproven).
6. *The plain fallbacks* (about half of the 49 MB of media): if the user drops them, take `textures.py`'s output out of
   `install.js`'s file list; the runtime's fallback branch may stay.
